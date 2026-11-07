"""
IDs únicos distribuidos (Snowflake de Twitter) + enrutamiento a shards.
Ejecuta:  python snowflake_shards.py

Layout de 64 bits:  1 bit signo | 41 bits timestamp(ms) | 10 bits máquina | 12 bits secuencia
  -> ~69 años de timestamps, 1024 máquinas, 4096 IDs por ms por máquina.
Los IDs son ordenables por tiempo (buenos para índices B-tree) y no requieren coordinación.
"""
from __future__ import annotations

import threading
import time

EPOCH_MS = 1_288_834_974_657  # epoch de Twitter (nov 2010)


class Snowflake:
    def __init__(self, machine_id: int, clock=lambda: int(time.time() * 1000)):
        if not 0 <= machine_id < 1024:
            raise ValueError("machine_id debe caber en 10 bits")
        self.machine_id, self.clock = machine_id, clock
        self.last_ms, self.seq = -1, 0
        self._lock = threading.Lock()

    def next_id(self) -> int:
        with self._lock:
            now = self.clock()
            if now < self.last_ms:
                raise RuntimeError("el reloj retrocedió: rechazamos para no duplicar IDs")
            if now == self.last_ms:
                self.seq = (self.seq + 1) & 0xFFF
                if self.seq == 0:            # agotamos 4096 IDs en este ms: esperar al siguiente
                    while (now := self.clock()) <= self.last_ms:
                        pass
            else:
                self.seq = 0
            self.last_ms = now
            return ((now - EPOCH_MS) << 22) | (self.machine_id << 12) | self.seq

    @staticmethod
    def parse(id_: int) -> dict:
        return {
            "timestamp_ms": (id_ >> 22) + EPOCH_MS,
            "machine": (id_ >> 12) & 0x3FF,
            "sequence": id_ & 0xFFF,
        }


class ShardRouter:
    """Instagram embebía el shard lógico dentro del ID: así cualquier servicio sabe
    dónde vive un registro solo mirando el ID. Muchos shards LÓGICOS (p.ej. 4096) se
    mapean a pocos servidores FÍSICOS; para escalar, mueves shards lógicos completos."""

    def __init__(self, logical_shards: int, physical: list[str]):
        self.logical = logical_shards
        self.map = {s: physical[s % len(physical)] for s in range(logical_shards)}

    def shard_for_user(self, user_id: int) -> int:
        return user_id % self.logical

    def server_for_user(self, user_id: int) -> str:
        return self.map[self.shard_for_user(user_id)]

    def move(self, logical_shard: int, to_server: str) -> None:
        self.map[logical_shard] = to_server


def demo() -> None:
    gen = Snowflake(machine_id=7)
    ids = [gen.next_id() for _ in range(10_000)]
    assert len(set(ids)) == len(ids), "sin duplicados"
    assert ids == sorted(ids), "monótonos en una misma máquina"
    print("ID:", ids[0], "->", Snowflake.parse(ids[0]))

    router = ShardRouter(logical_shards=4096, physical=["pg-1", "pg-2"])
    print("user 12345 vive en shard", router.shard_for_user(12345), "en", router.server_for_user(12345))
    # Escalar: agregamos pg-3 y le movemos 1/3 de los shards lógicos (sin rehash de datos individuales)
    for s in range(0, 4096, 3):
        router.move(s, "pg-3")
    print("tras rebalanceo, user 12345 está en", router.server_for_user(12345))
    print("OK")


if __name__ == "__main__":
    demo()
