"""
Circuit Breaker + Retry con backoff exponencial y jitter.
Ejecuta:  python circuit_breaker.py
"""
from __future__ import annotations

import random
import time
from enum import Enum
from typing import Callable, TypeVar

T = TypeVar("T")


class State(Enum):
    CLOSED = "CLOSED"        # tráfico normal, contamos fallos
    OPEN = "OPEN"            # fallamos rápido sin llamar al servicio
    HALF_OPEN = "HALF_OPEN"  # dejamos pasar pruebas para ver si se recuperó


class CircuitOpenError(Exception):
    pass


class CircuitBreaker:
    def __init__(self, failure_threshold=0.5, window=10, open_seconds=5.0,
                 half_open_probes=3, clock=time.monotonic):
        self.failure_threshold, self.window = failure_threshold, window
        self.open_seconds, self.half_open_probes, self.clock = open_seconds, half_open_probes, clock
        self.state = State.CLOSED
        self.results: list[bool] = []    # ventana deslizante por conteo (True = éxito)
        self.opened_at = 0.0
        self.probe_successes = 0

    def call(self, fn: Callable[[], T], fallback: Callable[[], T] | None = None) -> T:
        if self.state is State.OPEN:
            if self.clock() - self.opened_at >= self.open_seconds:
                self._transition(State.HALF_OPEN)
            else:
                if fallback:
                    return fallback()
                raise CircuitOpenError("circuito abierto: fail fast")
        try:
            result = fn()
        except Exception:
            self._on_result(False)
            if fallback:
                return fallback()
            raise
        self._on_result(True)
        return result

    def _on_result(self, ok: bool) -> None:
        if self.state is State.HALF_OPEN:
            if not ok:
                self._transition(State.OPEN)
            else:
                self.probe_successes += 1
                if self.probe_successes >= self.half_open_probes:
                    self._transition(State.CLOSED)
            return
        self.results = (self.results + [ok])[-self.window:]
        if len(self.results) == self.window:
            failure_rate = self.results.count(False) / self.window
            if failure_rate >= self.failure_threshold:
                self._transition(State.OPEN)

    def _transition(self, to: State) -> None:
        print(f"  [breaker] {self.state.value} -> {to.value}")
        self.state = to
        if to is State.OPEN:
            self.opened_at = self.clock()
        self.results, self.probe_successes = [], 0


def retry_with_backoff(fn: Callable[[], T], attempts=5, base=0.1, cap=2.0,
                       sleep=time.sleep, retry_on=(ConnectionError, TimeoutError)) -> T:
    """Full jitter (AWS Architecture Blog): espera = random(0, min(cap, base * 2^n)).
    El jitter evita que miles de clientes reintenten en el mismo instante (thundering herd).
    ¡Solo reintenta operaciones IDEMPOTENTES!"""
    for attempt in range(attempts):
        try:
            return fn()
        except retry_on:
            if attempt == attempts - 1:
                raise
            delay = random.uniform(0, min(cap, base * 2 ** attempt))
            sleep(delay)
    raise AssertionError("inalcanzable")


def demo() -> None:
    t = [0.0]
    cb = CircuitBreaker(window=4, open_seconds=5, half_open_probes=2, clock=lambda: t[0])
    healthy = [True]

    def payment_service():
        if not healthy[0]:
            raise ConnectionError("timeout")
        return "pago OK"

    def fallback():
        return "encolado para reintentar luego"

    print("1) Servicio cae:")
    healthy[0] = False
    for _ in range(4):
        cb.call(payment_service, fallback)
    assert cb.state is State.OPEN
    print("   llamada con circuito abierto ->", cb.call(payment_service, fallback))

    print("2) Pasan 5s y el servicio vuelve:")
    t[0] = 5.0
    healthy[0] = True
    print("  ", cb.call(payment_service), "|", cb.call(payment_service))
    assert cb.state is State.CLOSED

    print("3) Retry con backoff + jitter:")
    calls = [0]
    waits: list[float] = []

    def flaky():
        calls[0] += 1
        if calls[0] < 3:
            raise TimeoutError()
        return "ok al 3er intento"

    print("  ", retry_with_backoff(flaky, sleep=waits.append), "esperas:", [round(w, 3) for w in waits])
    print("OK")


if __name__ == "__main__":
    demo()
