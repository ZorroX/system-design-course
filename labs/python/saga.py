"""
Saga orquestada con compensaciones (checkout de e-commerce).
Ejecuta:  python saga.py

Cada servicio tiene su propia base de datos: no hay transacción ACID global.
La saga ejecuta pasos locales; si uno falla, ejecuta las COMPENSACIONES de los
pasos ya completados en orden inverso. Los pasos son idempotentes (clave = saga_id)
porque el orquestador puede reintentar tras un timeout.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable


class StepFailed(Exception):
    pass


# --------- servicios (cada uno con su "base de datos" local) ---------
@dataclass
class Inventory:
    stock: dict[str, int] = field(default_factory=lambda: {"sku-1": 5})
    reservations: dict[str, tuple[str, int]] = field(default_factory=dict)
    fail: bool = False

    def reserve(self, saga_id: str, sku: str, qty: int) -> None:
        if saga_id in self.reservations:          # idempotente: reintento = no-op
            return
        if self.fail or self.stock[sku] < qty:
            raise StepFailed("sin stock")
        self.stock[sku] -= qty
        self.reservations[saga_id] = (sku, qty)

    def release(self, saga_id: str) -> None:      # compensación (también idempotente)
        if saga_id in self.reservations:
            sku, qty = self.reservations.pop(saga_id)
            self.stock[sku] += qty


@dataclass
class Payments:
    charges: dict[str, int] = field(default_factory=dict)
    refunds: set[str] = field(default_factory=set)
    fail: bool = False

    def charge(self, saga_id: str, amount: int) -> None:
        if saga_id in self.charges:               # sin esto, un reintento cobraría dos veces
            return
        if self.fail:
            raise StepFailed("tarjeta rechazada")
        self.charges[saga_id] = amount

    def refund(self, saga_id: str) -> None:
        if saga_id in self.charges and saga_id not in self.refunds:
            self.refunds.add(saga_id)


@dataclass
class Shipping:
    shipments: set[str] = field(default_factory=set)
    fail: bool = False

    def schedule(self, saga_id: str) -> None:
        if self.fail:
            raise StepFailed("sin transportista disponible")
        self.shipments.add(saga_id)


@dataclass
class Orders:
    status: dict[str, str] = field(default_factory=dict)

    def create(self, saga_id: str) -> None:
        self.status.setdefault(saga_id, "PENDING")

    def cancel(self, saga_id: str) -> None:
        self.status[saga_id] = "CANCELLED"

    def approve(self, saga_id: str) -> None:
        self.status[saga_id] = "APPROVED"


# --------- orquestador ---------
@dataclass
class Step:
    name: str
    action: Callable[[], None]
    compensation: Callable[[], None] | None = None


class SagaOrchestrator:
    """En producción el estado de la saga se persiste (tabla saga_state o un motor
    como Temporal / AWS Step Functions) para sobrevivir a caídas del orquestador."""

    def __init__(self, saga_id: str, steps: list[Step]):
        self.saga_id, self.steps, self.log = saga_id, steps, []

    def run(self) -> bool:
        done: list[Step] = []
        for step in self.steps:
            try:
                step.action()
                done.append(step)
                self.log.append(f"OK {step.name}")
            except StepFailed as e:
                self.log.append(f"FALLA {step.name}: {e}")
                for prev in reversed(done):        # compensar en orden inverso
                    if prev.compensation:
                        prev.compensation()
                        self.log.append(f"compensar {prev.name}")
                return False
        return True


def checkout(saga_id: str, svc: dict) -> SagaOrchestrator:
    o, inv, pay, ship = svc["orders"], svc["inventory"], svc["payments"], svc["shipping"]
    saga = SagaOrchestrator(saga_id, [
        Step("crear pedido", lambda: o.create(saga_id), lambda: o.cancel(saga_id)),
        Step("reservar stock", lambda: inv.reserve(saga_id, "sku-1", 2), lambda: inv.release(saga_id)),
        Step("cobrar", lambda: pay.charge(saga_id, 4999), lambda: pay.refund(saga_id)),
        Step("programar envío", lambda: ship.schedule(saga_id)),
        Step("aprobar pedido", lambda: o.approve(saga_id)),
    ])
    saga.run()
    return saga


def services(**fail) -> dict:
    return {"orders": Orders(), "inventory": Inventory(fail=fail.get("inventory", False)),
            "payments": Payments(fail=fail.get("payments", False)), "shipping": Shipping(fail=fail.get("shipping", False))}


def demo() -> None:
    svc = services()
    s = checkout("saga-1", svc)
    print("Camino feliz:", " | ".join(s.log))
    assert svc["orders"].status["saga-1"] == "APPROVED" and svc["inventory"].stock["sku-1"] == 3

    svc = services(shipping=True)
    s = checkout("saga-2", svc)
    print("Falla el envío:", " | ".join(s.log))
    # Estado final consistente: pedido cancelado, stock devuelto, dinero reembolsado
    assert svc["orders"].status["saga-2"] == "CANCELLED"
    assert svc["inventory"].stock["sku-1"] == 5
    assert "saga-2" in svc["payments"].refunds

    svc = services()
    svc["payments"].charge("saga-3", 4999)
    svc["payments"].charge("saga-3", 4999)        # reintento tras un timeout
    print("Reintento de cobro: cobros registrados =", len(svc["payments"].charges))
    assert len(svc["payments"].charges) == 1
    print("OK")


if __name__ == "__main__":
    demo()
