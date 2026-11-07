"""
Rate limiting: Token Bucket y Sliding Window Counter.
Ejecuta:  python rate_limiter.py

En un sistema distribuido el estado vive en Redis (un script Lua hace el
"leer-calcular-escribir" de forma atómica). Aquí lo hacemos en memoria con un lock.
"""
from __future__ import annotations

import threading
import time


class TokenBucket:
    """Capacidad = ráfaga máxima; refill_rate = tasa sostenida (tokens/seg).
    Usado por AWS API Gateway, Stripe, etc."""

    def __init__(self, capacity: float, refill_rate: float, clock=time.monotonic):
        self.capacity, self.rate, self.clock = capacity, refill_rate, clock
        self.tokens = capacity
        self.last = clock()
        self._lock = threading.Lock()

    def allow(self, cost: float = 1.0) -> bool:
        with self._lock:
            now = self.clock()
            # recarga "perezosa": no hace falta un timer, se calcula al consultar
            self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)
            self.last = now
            if self.tokens >= cost:
                self.tokens -= cost
                return True
            return False


class SlidingWindowCounter:
    """Aproximación de Cloudflare: estimado = actual + anterior * (fracción de la
    ventana anterior que aún se solapa). Memoria O(1) por cliente."""

    def __init__(self, limit: int, window_s: float, clock=time.monotonic):
        self.limit, self.window, self.clock = limit, window_s, clock
        self.cur_start = clock()
        self.cur = self.prev = 0
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            now = self.clock()
            elapsed_windows = int((now - self.cur_start) // self.window)
            if elapsed_windows >= 1:
                self.prev = self.cur if elapsed_windows == 1 else 0
                self.cur = 0
                self.cur_start += elapsed_windows * self.window
            overlap = 1 - (now - self.cur_start) / self.window
            estimated = self.cur + self.prev * overlap
            if estimated < self.limit:
                self.cur += 1
                return True
            return False


class FakeClock:
    def __init__(self):
        self.t = 0.0

    def __call__(self) -> float:
        return self.t


def demo() -> None:
    clock = FakeClock()
    tb = TokenBucket(capacity=5, refill_rate=1, clock=clock)
    burst = [tb.allow() for _ in range(7)]
    print("Token bucket, ráfaga de 7:", burst)
    assert burst.count(True) == 5
    clock.t = 2.0  # pasan 2s -> 2 tokens nuevos
    assert [tb.allow() for _ in range(3)] == [True, True, False]

    clock = FakeClock()
    sw = SlidingWindowCounter(limit=10, window_s=60, clock=clock)
    assert all(sw.allow() for _ in range(10)) and not sw.allow()
    clock.t = 90  # mitad de la siguiente ventana: anterior pesa 50% -> 5 libres
    allowed = sum(sw.allow() for _ in range(10))
    print("Sliding window: permitidas a mitad de la ventana siguiente =", allowed)
    assert allowed == 5
    print("OK")


if __name__ == "__main__":
    demo()
