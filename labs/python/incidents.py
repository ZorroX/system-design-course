"""
Simulador de incidentes para practicar diagnóstico en Python.

  python incidents.py            -> autodiagnóstico rápido (termina solo)
  python incidents.py cpu        -> hilo al 100%           -> py-spy top --pid PID / py-spy dump --pid PID
  python incidents.py leak       -> la memoria crece       -> tracemalloc / memray / objgraph
  python incidents.py deadlock   -> dos hilos bloqueados   -> py-spy dump --pid PID

Equivalencias con Java: jstack ~ py-spy dump; jmap -histo ~ tracemalloc/objgraph; async-profiler ~ py-spy record.
"""
import os
import re
import sys
import threading
import time
import tracemalloc
import traceback

EVIL = re.compile(r"^(a+)+$")
RESPONSES = {}  # "cache" sin expiracion = fuga


def start_cpu():
    def run():
        s = "a" * 18 + "!"
        while True:
            EVIL.match(s)
    t = threading.Thread(target=run, name="http-exec-17", daemon=True)
    t.start()
    return t


def start_leak(n):
    for i in range(n):
        RESPONSES[f"idem-{i}"] = b"x" * 512


def start_deadlock():
    a, b = threading.Lock(), threading.Lock()

    def w(x, y):
        with x:
            time.sleep(0.1)
            with y:
                pass

    threading.Thread(target=w, args=(a, b), name="transfer-worker-3", daemon=True).start()
    threading.Thread(target=w, args=(b, a), name="transfer-worker-7", daemon=True).start()


def thread_dump(prefix):
    """Equivalente casero de jstack / py-spy dump."""
    frames = sys._current_frames()
    for t in threading.enumerate():
        if t.name.startswith(prefix) and t.ident in frames:
            stack = traceback.extract_stack(frames[t.ident])[-2:]
            where = " <- ".join(f"{f.name}:{f.lineno}" for f in reversed(stack))
            print(f"  [{t.name}] {where}")


def selftest():
    print("=== Incidente 1: CPU al 100% ===")
    start_cpu()
    time.sleep(0.5)
    thread_dump("http-exec")
    print("  -> el hilo vive dentro de re.match con (a+)+$: backtracking catastrofico.")

    print("\n=== Incidente 2: fuga de memoria ===")
    tracemalloc.start()
    snap1 = tracemalloc.take_snapshot()
    start_leak(50_000)
    snap2 = tracemalloc.take_snapshot()
    top = snap2.compare_to(snap1, "lineno")[0]
    print(f"  mayor crecimiento: {top.traceback[0]} +{top.size_diff // 1024} KiB ({len(RESPONSES):,} entradas)")
    print("  -> arreglo: cache con limite y TTL (cachetools.TTLCache) o Redis con EX.")
    tracemalloc.stop()

    print("\n=== Incidente 3: deadlock ===")
    start_deadlock()
    time.sleep(0.4)
    thread_dump("transfer-worker")
    print("  -> ambos esperan en __enter__ del lock del otro: orden de adquisicion invertido.")
    print("\nPractica en vivo: python incidents.py cpu  (y en otra terminal: py-spy dump --pid PID)")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "selftest"
    if mode == "selftest":
        selftest()
        sys.stdout.flush()
        os._exit(0)
    print(f"PID {os.getpid()} - modo {mode}. Ctrl+C para salir.")
    {"cpu": start_cpu, "deadlock": start_deadlock}.get(mode, lambda: None)()
    if mode == "leak":
        i = 0
        while True:
            RESPONSES[f"idem-{i}"] = b"x" * 512
            i += 1
            if i % 1000 == 0:
                time.sleep(0.01)
    while True:
        time.sleep(1)


if __name__ == "__main__":
    main()
