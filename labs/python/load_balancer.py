"""
Estrategias de balanceo de carga.
Ejecuta:  python load_balancer.py
"""
from __future__ import annotations

import itertools
import random
from collections import Counter
from dataclasses import dataclass, field


@dataclass
class Server:
    name: str
    weight: int = 1
    active: int = 0          # conexiones abiertas (para least-connections)
    healthy: bool = True
    current_weight: int = field(default=0, repr=False)  # para smooth WRR


class RoundRobin:
    def __init__(self, servers: list[Server]):
        self.servers = servers
        self._it = itertools.cycle(range(len(servers)))

    def pick(self) -> Server:
        # Salta servidores no sanos (health checks)
        for _ in range(len(self.servers)):
            s = self.servers[next(self._it)]
            if s.healthy:
                return s
        raise RuntimeError("no hay servidores sanos")


class SmoothWeightedRoundRobin:
    """Algoritmo usado por NGINX: reparte según peso sin ráfagas (a a b a c a a ...)."""

    def __init__(self, servers: list[Server]):
        self.servers = servers

    def pick(self) -> Server:
        alive = [s for s in self.servers if s.healthy]
        total = sum(s.weight for s in alive)
        for s in alive:
            s.current_weight += s.weight
        best = max(alive, key=lambda s: s.current_weight)
        best.current_weight -= total
        return best


class LeastConnections:
    def __init__(self, servers: list[Server]):
        self.servers = servers

    def pick(self) -> Server:
        return min((s for s in self.servers if s.healthy), key=lambda s: s.active)


class PowerOfTwoChoices:
    """Elige 2 al azar y se queda con el menos cargado: casi tan bueno como
    least-connections pero sin necesitar estado global perfecto (Envoy, HAProxy)."""

    def __init__(self, servers: list[Server]):
        self.servers = servers

    def pick(self) -> Server:
        a, b = random.sample([s for s in self.servers if s.healthy], 2)
        return a if a.active <= b.active else b


def demo() -> None:
    servers = [Server("A", weight=5), Server("B", weight=1), Server("C", weight=1)]

    wrr = SmoothWeightedRoundRobin(servers)
    seq = "".join(wrr.pick().name for _ in range(7))
    print("Smooth WRR (5:1:1):", seq)
    assert Counter(seq) == {"A": 5, "B": 1, "C": 1}

    rr = RoundRobin(servers)
    servers[1].healthy = False  # B cae: el health check lo saca de rotación
    seq = "".join(rr.pick().name for _ in range(6))
    print("Round robin con B caído:", seq)
    assert "B" not in seq
    servers[1].healthy = True

    # Simulación: peticiones de duración variable -> least-connections equilibra mejor
    random.seed(7)
    for strategy in (RoundRobin(servers), LeastConnections(servers), PowerOfTwoChoices(servers)):
        for s in servers:
            s.active = 0
        in_flight: list[tuple[int, Server]] = []
        peak: Counter[str] = Counter()
        for t in range(2_000):
            still_running = []
            for end, srv in in_flight:
                if end > t:
                    still_running.append((end, srv))
                else:
                    srv.active -= 1  # la petición terminó: libera la conexión
            in_flight = still_running
            s = strategy.pick()
            s.active += 1
            in_flight.append((t + random.choice([1, 1, 1, 30]), s))  # 25% de peticiones lentas
            for srv in servers:
                peak[srv.name] = max(peak[srv.name], srv.active)
        print(f"{type(strategy).__name__:<20} pico de conexiones por servidor: {dict(peak)}")

    print("OK")


if __name__ == "__main__":
    demo()
