"""
Consistent hashing con nodos virtuales (vnodes).
Ejecuta:  python consistent_hash.py
"""
from __future__ import annotations

import bisect
import hashlib
from collections import Counter


def _hash(key: str) -> int:
    # md5 por distribución uniforme (no por seguridad). Cassandra usa Murmur3.
    return int.from_bytes(hashlib.md5(key.encode()).digest()[:8], "big")


class HashRing:
    def __init__(self, nodes: list[str] | None = None, vnodes: int = 100):
        self.vnodes = vnodes
        self._ring: list[int] = []          # hashes ordenados
        self._owner: dict[int, str] = {}    # hash -> nodo físico
        for n in nodes or []:
            self.add(n)

    def add(self, node: str) -> None:
        for i in range(self.vnodes):
            h = _hash(f"{node}#{i}")
            bisect.insort(self._ring, h)
            self._owner[h] = node

    def remove(self, node: str) -> None:
        for i in range(self.vnodes):
            h = _hash(f"{node}#{i}")
            self._ring.remove(h)
            del self._owner[h]

    def get(self, key: str) -> str:
        """Primer vnode en sentido horario desde hash(key)."""
        idx = bisect.bisect(self._ring, _hash(key)) % len(self._ring)
        return self._owner[self._ring[idx]]

    def preference_list(self, key: str, n: int) -> list[str]:
        """N nodos físicos distintos para replicar (como Dynamo/Cassandra)."""
        idx = bisect.bisect(self._ring, _hash(key))
        out: list[str] = []
        for i in range(len(self._ring)):
            node = self._owner[self._ring[(idx + i) % len(self._ring)]]
            if node not in out:
                out.append(node)
                if len(out) == n:
                    break
        return out


def demo() -> None:
    keys = [f"user:{i}" for i in range(10_000)]

    ring = HashRing(["cache-a", "cache-b", "cache-c", "cache-d"], vnodes=150)
    before = {k: ring.get(k) for k in keys}
    print("Distribución con 4 nodos:", dict(Counter(before.values())))

    ring.add("cache-e")
    moved = sum(1 for k in keys if ring.get(k) != before[k])
    print(f"Al agregar un 5º nodo se movieron {moved / len(keys):.1%} de las claves (ideal ~ 1/5 = 20%)")

    # Comparación con hash % N, que remapea casi todo:
    modulo_moved = sum(1 for k in keys if _hash(k) % 4 != _hash(k) % 5)
    print(f"Con hash % N se habrían movido {modulo_moved / len(keys):.1%}")
    assert moved < modulo_moved / 2

    print("Réplicas para user:42 ->", ring.preference_list("user:42", 3))
    print("OK")


if __name__ == "__main__":
    demo()
