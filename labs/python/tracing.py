"""
Mini tracing distribuido + métricas RED, al estilo OpenTelemetry.
Ejecuta:  python tracing.py

Ideas que demuestra:
  * Un trace = árbol de spans que comparten trace_id; cada span conoce a su padre.
  * El contexto viaja entre servicios en un header (W3C `traceparent`).
  * contextvars mantiene el span "actual" incluso con asyncio.
  * Métricas RED (Rate, Errors, Duration) agregadas por servicio, con percentiles.
"""
from __future__ import annotations

import contextvars
import random
import secrets
import time
from collections import defaultdict
from contextlib import contextmanager
from dataclasses import dataclass, field

_current: contextvars.ContextVar["Span | None"] = contextvars.ContextVar("span", default=None)
FINISHED: list["Span"] = []


@dataclass
class Span:
    name: str
    service: str
    trace_id: str
    span_id: str = field(default_factory=lambda: secrets.token_hex(8))
    parent_id: str | None = None
    start: float = field(default_factory=time.perf_counter)
    end: float = 0.0
    error: str | None = None
    attributes: dict = field(default_factory=dict)

    @property
    def ms(self) -> float:
        return (self.end - self.start) * 1000


@contextmanager
def span(name: str, service: str, parent_header: str | None = None):
    """Abre un span hijo del actual (o del header entrante si cruzamos un servicio)."""
    parent = _current.get()
    if parent_header:  # formato W3C: 00-<trace_id>-<parent_span_id>-01
        _, trace_id, parent_id, _ = parent_header.split("-")
    elif parent:
        trace_id, parent_id = parent.trace_id, parent.span_id
    else:
        trace_id, parent_id = secrets.token_hex(16), None
    s = Span(name, service, trace_id, parent_id=parent_id)
    token = _current.set(s)
    try:
        yield s
    except Exception as e:
        s.error = repr(e)
        raise
    finally:
        s.end = time.perf_counter()
        _current.reset(token)
        FINISHED.append(s)
        METRICS.record(service, s.ms, s.error is not None)


def outgoing_headers() -> dict:
    """Lo que un cliente HTTP instrumentado añade automáticamente."""
    s = _current.get()
    return {"traceparent": f"00-{s.trace_id}-{s.span_id}-01"} if s else {}


class RedMetrics:
    def __init__(self):
        self.lat: dict[str, list[float]] = defaultdict(list)
        self.err: dict[str, int] = defaultdict(int)

    def record(self, service: str, ms: float, error: bool) -> None:
        self.lat[service].append(ms)
        self.err[service] += error

    def report(self) -> None:
        print(f"{'servicio':<12}{'rate':>6}{'err%':>7}{'p50':>8}{'p99':>8}")
        for svc, xs in sorted(self.lat.items()):
            xs = sorted(xs)
            p = lambda q: xs[min(len(xs) - 1, int(q * len(xs)))]
            print(f"{svc:<12}{len(xs):>6}{100 * self.err[svc] / len(xs):>6.1f}%{p(.5):>7.1f}ms{p(.99):>6.1f}ms")


METRICS = RedMetrics()


# --------- servicios simulados ---------
def payments(headers: dict) -> None:
    with span("POST /charge", "payments", headers.get("traceparent")):
        time.sleep(random.choice([0.002] * 9 + [0.030]))  # 10% lentas
        if random.random() < 0.05:
            raise RuntimeError("card declined upstream")


def inventory(headers: dict) -> None:
    with span("POST /reserve", "inventory", headers.get("traceparent")):
        with span("SELECT stock", "inventory-db"):
            time.sleep(0.003)


def orders(headers: dict) -> None:
    with span("POST /orders", "orders", headers.get("traceparent")):
        inventory(outgoing_headers())
        payments(outgoing_headers())


def gateway() -> str:
    with span("POST /checkout", "gateway") as root:
        try:
            orders(outgoing_headers())
        except RuntimeError:
            root.attributes["http.status"] = 502
        return root.trace_id


def print_waterfall(trace_id: str) -> None:
    spans = sorted((s for s in FINISHED if s.trace_id == trace_id), key=lambda s: s.start)
    t0 = spans[0].start
    total = max(s.end for s in spans) - t0
    depth = {}
    for s in spans:
        depth[s.span_id] = 0 if s.parent_id is None else depth.get(s.parent_id, 0) + 1
        offset = int((s.start - t0) / total * 40)
        width = max(1, int((s.end - s.start) / total * 40))
        bar = " " * offset + ("X" if s.error else "#") * width
        label = '  ' * depth[s.span_id] + s.service + ' ' + s.name
        print(f"{label:<32} |{bar:<41}| {s.ms:6.1f} ms")


def demo() -> None:
    random.seed(3)
    ids = [gateway() for _ in range(200)]
    slowest = max(ids, key=lambda t: next(s.ms for s in FINISHED if s.trace_id == t and s.parent_id is None))
    print("Trace más lento (waterfall):")
    print_waterfall(slowest)
    print()
    METRICS.report()
    # Todos los spans de un trace comparten trace_id y forman un árbol
    tr = [s for s in FINISHED if s.trace_id == slowest]
    roots = [s for s in tr if s.parent_id is None]
    assert len(roots) == 1 and len({s.trace_id for s in tr}) == 1 and len(tr) == 5
    print("OK")


if __name__ == "__main__":
    demo()
