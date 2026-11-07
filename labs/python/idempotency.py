"""
Idempotency keys para APIs de pagos (patrón popularizado por Stripe).
Ejecuta:  python idempotency.py

El cliente genera una clave única (UUID) por operación lógica y la envía en el header
`Idempotency-Key`. Si la red falla y reintenta, el servidor devuelve la MISMA respuesta
en lugar de cobrar dos veces.
"""
from __future__ import annotations

import hashlib
import json
import threading
import uuid
from dataclasses import dataclass


@dataclass
class StoredResponse:
    request_hash: str
    status: int | None = None   # None => en curso
    body: dict | None = None


class IdempotencyStore:
    """En producción: tabla en la misma DB transaccional o Redis con SET NX + TTL (24h)."""

    def __init__(self):
        self._data: dict[str, StoredResponse] = {}
        self._lock = threading.Lock()

    def begin(self, key: str, request_hash: str) -> StoredResponse | None:
        with self._lock:
            existing = self._data.get(key)
            if existing is None:
                self._data[key] = StoredResponse(request_hash)  # reservamos la clave (SET NX)
                return None
            return existing

    def complete(self, key: str, status: int, body: dict) -> None:
        with self._lock:
            self._data[key].status, self._data[key].body = status, body


class PaymentsAPI:
    def __init__(self):
        self.store = IdempotencyStore()
        self.charges: list[dict] = []

    def post_charge(self, headers: dict, payload: dict) -> tuple[int, dict]:
        key = headers.get("Idempotency-Key")
        if not key:
            return 400, {"error": "Idempotency-Key requerido"}
        req_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

        prior = self.store.begin(key, req_hash)
        if prior is not None:
            if prior.request_hash != req_hash:
                return 422, {"error": "misma clave con distinto payload"}
            if prior.status is None:
                return 409, {"error": "petición original aún en curso"}
            return prior.status, {**prior.body, "replayed": True}

        charge = {"id": f"ch_{uuid.uuid4().hex[:8]}", "amount": payload["amount"]}
        self.charges.append(charge)  # efecto secundario real (cobro)
        self.store.complete(key, 201, charge)
        return 201, charge


def demo() -> None:
    api = PaymentsAPI()
    key = str(uuid.uuid4())
    first = api.post_charge({"Idempotency-Key": key}, {"amount": 4999, "currency": "usd"})
    retry = api.post_charge({"Idempotency-Key": key}, {"amount": 4999, "currency": "usd"})
    print("1er intento:", first)
    print("reintento  :", retry)
    assert len(api.charges) == 1 and retry[1]["id"] == first[1]["id"]

    bad = api.post_charge({"Idempotency-Key": key}, {"amount": 1, "currency": "usd"})
    print("misma clave, otro payload:", bad)
    assert bad[0] == 422
    print("OK - un solo cobro pese al reintento")


if __name__ == "__main__":
    demo()
