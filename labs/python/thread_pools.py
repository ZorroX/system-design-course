"""
Pools de hilos y procesos en Python: I/O vs CPU, el GIL, colas acotadas y deadlocks.
Ejecuta:  python thread_pools.py

Equivalencias: concurrent.futures.ThreadPoolExecutor ~ ThreadPoolExecutor de Java;
para CPU en Python se usan procesos (ProcessPoolExecutor) por el GIL; asyncio para mucho I/O.
"""
import os
import threading
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor


def io_task(_=None):
    time.sleep(0.04)  # espera al adquirente


def cpu_task(n=1_500_000):
    s = 0
    for i in range(n):
        s += i * i
    return s


def timed(fn):
    t0 = time.perf_counter()
    fn()
    return (time.perf_counter() - t0) * 1000


def main():
    cores = os.cpu_count() or 4
    print("=== 1) I/O: mas hilos = mas concurrencia (100 tareas de 40 ms) ===")
    for workers in (4, 16, 50):
        with ThreadPoolExecutor(max_workers=workers) as pool:
            ms = timed(lambda: list(pool.map(io_task, range(100))))
        print(f"  {workers:3d} hilos -> {ms:6.0f} ms")

    print("\n=== 2) CPU: el GIL impide paralelismo con hilos; los procesos si escalan ===")
    seq = timed(lambda: [cpu_task() for _ in range(8)])
    with ThreadPoolExecutor(max_workers=cores) as pool:
        thr = timed(lambda: list(pool.map(lambda _: cpu_task(), range(8))))
    with ProcessPoolExecutor(max_workers=min(cores, 8)) as pool:
        prc = timed(lambda: list(pool.map(cpu_task, [1_500_000] * 8)))
    print(f"  secuencial {seq:6.0f} ms | {cores} hilos {thr:6.0f} ms | procesos {prc:6.0f} ms")
    print("  (Python 3.13+ tiene un modo experimental sin GIL; Java no tiene GIL: ahi si usas hilos.)")

    print("\n=== 3) Cola acotada: ThreadPoolExecutor de Python tiene cola SIN limite ===")
    sem = threading.BoundedSemaphore(8)  # máx. 8 tareas en vuelo (4 ejecutando + 4 esperando)
    rejected = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        for _ in range(20):
            if not sem.acquire(blocking=False):
                rejected += 1  # equivalente a AbortPolicy: responde 503 y que el cliente reintente
                continue
            fut = pool.submit(io_task)
            fut.add_done_callback(lambda _f: sem.release())
    print(f"  20 envios de golpe con capacidad 8 -> rechazados: {rejected}")

    print("\n=== 4) Deadlock y su arreglo ===")
    a, b = threading.Lock(), threading.Lock()
    stuck = []

    def transfer(first, second, name):
        with first:
            time.sleep(0.1)
            if not second.acquire(timeout=0.5):  # en producción esto colgaría para siempre
                stuck.append(name)
                return
            second.release()

    t1 = threading.Thread(target=transfer, args=(a, b, "A->B"))
    t2 = threading.Thread(target=transfer, args=(b, a, "B->A"))
    t1.start(); t2.start(); t1.join(); t2.join()
    print(f"  orden opuesto: bloqueadas {stuck} (en Python lo verias con py-spy dump --pid PID)")

    stuck.clear()
    locks = {1: threading.Lock(), 2: threading.Lock()}

    def ordered(x, y):
        first, second = sorted((x, y))
        with locks[first]:
            time.sleep(0.1)
            with locks[second]:
                pass

    t3 = threading.Thread(target=ordered, args=(1, 2))
    t4 = threading.Thread(target=ordered, args=(2, 1))
    t3.start(); t4.start(); t3.join(2); t4.join(2)
    print("  orden global por id:", "ambas terminaron OK" if not (t3.is_alive() or t4.is_alive()) else "bloqueadas")


if __name__ == "__main__":
    main()
