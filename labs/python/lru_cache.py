"""
LRU Cache O(1) + patrón cache-aside con TTL.
Ejecuta:  python lru_cache.py
"""
from __future__ import annotations

import time
from typing import Callable, Generic, Hashable, Optional, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")


class _Node(Generic[K, V]):
    __slots__ = ("key", "value", "expires_at", "prev", "next")

    def __init__(self, key, value, expires_at):
        self.key, self.value, self.expires_at = key, value, expires_at
        self.prev: Optional[_Node] = None
        self.next: Optional[_Node] = None


class LRUCache(Generic[K, V]):
    """Hash map + lista doblemente enlazada: get/put en O(1).
    (En producción: functools.lru_cache, cachetools o directamente Redis.)"""

    def __init__(self, capacity: int, ttl_seconds: float | None = None):
        self.capacity, self.ttl = capacity, ttl_seconds
        self.map: dict[K, _Node[K, V]] = {}
        self.head = _Node(None, None, None)  # centinela: más reciente después de head
        self.tail = _Node(None, None, None)  # centinela: menos reciente antes de tail
        self.head.next, self.tail.prev = self.tail, self.head
        self.hits = self.misses = 0

    def _unlink(self, n: _Node) -> None:
        n.prev.next, n.next.prev = n.next, n.prev

    def _push_front(self, n: _Node) -> None:
        n.prev, n.next = self.head, self.head.next
        self.head.next.prev = n
        self.head.next = n

    def get(self, key: K) -> Optional[V]:
        n = self.map.get(key)
        if n is None or (n.expires_at is not None and n.expires_at < time.monotonic()):
            if n is not None:  # expiró: lo tratamos como miss
                self._unlink(n)
                del self.map[key]
            self.misses += 1
            return None
        self._unlink(n)
        self._push_front(n)
        self.hits += 1
        return n.value

    def put(self, key: K, value: V) -> None:
        expires = time.monotonic() + self.ttl if self.ttl else None
        if key in self.map:
            self._unlink(self.map[key])
        elif len(self.map) >= self.capacity:
            lru = self.tail.prev            # el menos usado recientemente
            self._unlink(lru)
            del self.map[lru.key]
        n = _Node(key, value, expires)
        self.map[key] = n
        self._push_front(n)

    def invalidate(self, key: K) -> None:
        n = self.map.pop(key, None)
        if n:
            self._unlink(n)

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total else 0.0


class UserRepository:
    """Cache-aside: la app consulta la caché; en miss lee la DB y llena la caché.
    En escrituras: actualiza la DB y INVALIDA la caché (no la actualiza) para
    evitar carreras que dejen datos viejos."""

    def __init__(self, db: dict[int, str], cache: LRUCache[int, str], db_latency_s=0.01):
        self.db, self.cache, self.db_latency_s = db, cache, db_latency_s

    def find(self, user_id: int) -> Optional[str]:
        if (cached := self.cache.get(user_id)) is not None:
            return cached
        time.sleep(self.db_latency_s)  # simula ida a la DB
        value = self.db.get(user_id)
        if value is not None:
            self.cache.put(user_id, value)
        return value

    def update(self, user_id: int, name: str) -> None:
        self.db[user_id] = name
        self.cache.invalidate(user_id)


def demo() -> None:
    c: LRUCache[str, int] = LRUCache(capacity=2)
    c.put("a", 1)
    c.put("b", 2)
    c.get("a")          # 'a' pasa a ser el más reciente
    c.put("c", 3)       # expulsa 'b' (LRU)
    assert c.get("b") is None and c.get("a") == 1 and c.get("c") == 3
    print("LRU expulsó 'b' correctamente")

    repo = UserRepository({i: f"user-{i}" for i in range(100)}, LRUCache(capacity=20, ttl_seconds=60))
    t0 = time.perf_counter()
    import random
    random.seed(1)
    # distribución sesgada (80/20): pocos usuarios muy populares
    for _ in range(300):
        uid = random.randint(0, 9) if random.random() < 0.8 else random.randint(10, 99)
        repo.find(uid)
    elapsed = time.perf_counter() - t0
    print(f"hit rate: {repo.cache.hit_rate:.0%}  tiempo: {elapsed:.2f}s (sin caché serían ~{300 * 0.01:.1f}s)")

    repo.update(1, "renamed")
    assert repo.find(1) == "renamed", "tras invalidar debe leer el valor nuevo"
    print("OK")


if __name__ == "__main__":
    demo()
