"""
Mini-Kafka: log particionado, claves -> partición, consumer groups con offsets.
Ejecuta:  python mini_kafka.py

Ideas clave que demuestra:
  * El orden solo está garantizado DENTRO de una partición (misma clave => misma partición).
  * Cada consumer group lleva sus propios offsets: N grupos leen el mismo stream de forma independiente.
  * Una partición la consume UN solo consumidor del grupo => paralelismo máximo = nº de particiones.
  * Entrega "at-least-once": si commiteas el offset DESPUÉS de procesar, un crash puede re-procesar.
"""
from __future__ import annotations

import zlib
from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class Record:
    offset: int
    key: str
    value: str


class Topic:
    def __init__(self, name: str, partitions: int):
        self.name = name
        self.partitions: list[list[Record]] = [[] for _ in range(partitions)]

    def partition_for(self, key: str) -> int:
        return zlib.crc32(key.encode()) % len(self.partitions)  # Kafka usa murmur2

    def produce(self, key: str, value: str) -> tuple[int, int]:
        p = self.partition_for(key)
        log = self.partitions[p]
        rec = Record(len(log), key, value)  # append-only: el offset es la posición
        log.append(rec)
        return p, rec.offset


class ConsumerGroup:
    def __init__(self, topic: Topic, group_id: str, members: list[str]):
        self.topic, self.group_id = topic, group_id
        self.committed: dict[int, int] = defaultdict(int)  # partición -> siguiente offset
        self.assignment: dict[str, list[int]] = {}
        self.rebalance(members)

    def rebalance(self, members: list[str]) -> None:
        """Asignación range/round-robin: cada partición a un único miembro."""
        self.assignment = {m: [] for m in members}
        for p in range(len(self.topic.partitions)):
            self.assignment[members[p % len(members)]].append(p)

    def poll(self, member: str, max_records: int = 10) -> list[tuple[int, Record]]:
        out = []
        for p in self.assignment.get(member, []):
            start = self.committed[p]
            out += [(p, r) for r in self.topic.partitions[p][start:start + max_records]]
        return out

    def commit(self, partition: int, offset: int) -> None:
        self.committed[partition] = offset + 1

    def lag(self) -> dict[int, int]:
        return {p: len(log) - self.committed[p] for p, log in enumerate(self.topic.partitions)}


def demo() -> None:
    orders = Topic("orders", partitions=3)
    for i in range(12):
        user = f"user-{i % 4}"
        orders.produce(user, f"order-{i}")

    # Orden por clave: los eventos del mismo usuario están en la misma partición y en orden
    p = orders.partition_for("user-1")
    seq = [r.value for r in orders.partitions[p] if r.key == "user-1"]
    print("Eventos de user-1 (en orden):", seq)
    assert seq == ["order-1", "order-5", "order-9"]

    billing = ConsumerGroup(orders, "billing", ["c1", "c2"])
    analytics = ConsumerGroup(orders, "analytics", ["a1"])
    print("Asignación billing:", billing.assignment)

    for member in ("c1", "c2"):
        for part, rec in billing.poll(member):
            billing.commit(part, rec.offset)  # commit tras procesar => at-least-once
    print("Lag billing:", billing.lag(), "| Lag analytics (no ha leído):", analytics.lag())
    assert sum(billing.lag().values()) == 0 and sum(analytics.lag().values()) == 12

    billing.rebalance(["c1", "c2", "c3", "c4"])  # 4 consumidores, 3 particiones
    idle = [m for m, ps in billing.assignment.items() if not ps]
    print("Tras escalar a 4 consumidores, ociosos:", idle, "(más consumidores que particiones no ayuda)")
    print("OK")


if __name__ == "__main__":
    demo()
