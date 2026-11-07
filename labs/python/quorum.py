"""
Replicación con quórum (estilo Dynamo/Cassandra): N réplicas, W escrituras, R lecturas.
Ejecuta:  python quorum.py

Si R + W > N, todo conjunto de lectura se solapa con el último conjunto de escritura
=> la lectura ve el valor más reciente (consistencia fuerte para ese par de operaciones).
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field


@dataclass
class Replica:
    name: str
    up: bool = True
    data: dict[str, tuple[int, str]] = field(default_factory=dict)  # key -> (version, value)


class QuorumStore:
    def __init__(self, n=3, r=2, w=2):
        self.replicas = [Replica(f"r{i}") for i in range(n)]
        self.n, self.r, self.w = n, r, w

    def write(self, key: str, value: str) -> bool:
        # versión = timestamp lógico; en Cassandra es el timestamp (last-write-wins)
        version = 1 + max((rep.data.get(key, (0, ""))[0] for rep in self.replicas), default=0)
        alive = [rep for rep in self.replicas if rep.up]
        random.shuffle(alive)
        acks = 0
        for rep in alive[: self.w]:   # el coordinador espera W acks (el resto sería async)
            rep.data[key] = (version, value)
            acks += 1
        return acks >= self.w

    def read(self, key: str) -> str | None:
        alive = [rep for rep in self.replicas if rep.up]
        if len(alive) < self.r:
            raise RuntimeError(f"no hay quórum de lectura ({len(alive)}/{self.r})")
        sample = random.sample(alive, self.r)
        answers = [rep.data.get(key, (0, None)) for rep in sample]
        version, value = max(answers, key=lambda a: a[0])
        for rep in sample:            # read repair: arreglamos réplicas atrasadas
            if rep.data.get(key, (0, None))[0] < version:
                rep.data[key] = (version, value)
        return value


def stale_reads(n: int, r: int, w: int, trials=2_000) -> int:
    random.seed(42)
    store, stale = QuorumStore(n, r, w), 0
    for i in range(trials):
        store.write("k", f"v{i}")
        if store.read("k") != f"v{i}":
            stale += 1
    return stale


def demo() -> None:
    for n, r, w in [(3, 1, 1), (3, 2, 2), (3, 1, 3), (5, 3, 3)]:
        s = stale_reads(n, r, w)
        tag = "R+W>N OK" if r + w > n else "R+W<=N X"
        print(f"N={n} R={r} W={w}  {tag}  lecturas viejas: {s}")
        if r + w > n:
            assert s == 0

    store = QuorumStore(3, 2, 2)
    store.write("cart", "[libro]")
    store.replicas[0].up = False                # cae una réplica: seguimos operando
    assert store.write("cart", "[libro, taza]")
    print("Con 1 réplica caída, lectura:", store.read("cart"))
    store.replicas[1].up = False                # caen 2 de 3: perdemos quórum
    try:
        store.read("cart")
    except RuntimeError as e:
        print("Con 2 caídas:", e, "-> elegimos Consistencia sobre Disponibilidad (CP)")
    print("OK")


if __name__ == "__main__":
    demo()
