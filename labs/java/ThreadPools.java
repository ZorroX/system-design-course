import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Thread pools en Java: dimensionado, colas acotadas, políticas de rechazo y deadlocks.
 * Ejecuta (Java 17+):  java ThreadPools.java
 *
 * En Spring Boot: server.tomcat.threads.max (200 por defecto), spring.datasource.hikari.maximum-pool-size,
 * y un ThreadPoolTaskExecutor propio para @Async (nunca el pool común para I/O).
 */
public class ThreadPools {

    // Tarea "de pagos": 2 ms de CPU + 40 ms esperando al adquirente (I/O)
    static void ioTask() {
        long end = System.nanoTime() + 2_000_000;
        while (System.nanoTime() < end) { /* cálculo */ }
        try { Thread.sleep(40); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    static long runTasks(ExecutorService pool, int n) throws Exception {
        long t0 = System.nanoTime();
        CountDownLatch done = new CountDownLatch(n);
        for (int i = 0; i < n; i++) pool.execute(() -> { ioTask(); done.countDown(); });
        done.await();
        pool.shutdown();
        return (System.nanoTime() - t0) / 1_000_000;
    }

    public static void main(String[] args) throws Exception {
        int cores = Runtime.getRuntime().availableProcessors();
        System.out.println("=== 1) Dimensionar para I/O (200 tareas de 2 ms CPU + 40 ms espera) ===");
        System.out.printf("Núcleos: %d · Fórmula de Goetz: hilos ≈ núcleos × (1 + espera/cálculo) = %d%n", cores, cores * (1 + 40 / 2));
        for (int threads : new int[]{4, 16, 64}) {
            long ms = runTasks(Executors.newFixedThreadPool(threads), 200);
            System.out.printf("  %3d hilos → %5d ms  (≈ %d tareas/s)%n", threads, ms, 200_000 / Math.max(1, ms));
        }

        System.out.println("\n=== 2) Cola acotada + políticas de rechazo (core=2, max=4, cola=4, 20 tareas) ===");
        for (RejectedExecutionHandler policy : new RejectedExecutionHandler[]{new ThreadPoolExecutor.AbortPolicy(), new ThreadPoolExecutor.CallerRunsPolicy()}) {
            ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 4, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(4), policy);
            AtomicInteger rejected = new AtomicInteger();
            AtomicInteger byCaller = new AtomicInteger();
            String caller = Thread.currentThread().getName();
            for (int i = 0; i < 20; i++) {
                try {
                    pool.execute(() -> { if (Thread.currentThread().getName().equals(caller)) byCaller.incrementAndGet(); ioTask(); });
                } catch (RejectedExecutionException e) {
                    rejected.incrementAndGet();
                }
            }
            pool.shutdown();
            pool.awaitTermination(10, TimeUnit.SECONDS);
            System.out.printf("  %-18s rechazadas=%2d  ejecutadas por el hilo que envía=%2d  hilos máx=%d%n",
                    policy.getClass().getSimpleName(), rejected.get(), byCaller.get(), pool.getLargestPoolSize());
        }
        System.out.println("  → Abort falla rápido (el cliente recibe 503 y reintenta); CallerRuns frena al productor (backpressure).");
        System.out.println("  → Executors.newFixedThreadPool usa LinkedBlockingQueue SIN límite: con un pico, la cola crece hasta el OutOfMemoryError.");

        System.out.println("\n=== 3) Deadlock: candados en orden opuesto ===");
        ReentrantLock a = new ReentrantLock(), b = new ReentrantLock();
        Thread t1 = new Thread(() -> transfer(a, b), "transfer-A-B");
        Thread t2 = new Thread(() -> transfer(b, a), "transfer-B-A");
        t1.setDaemon(true);
        t2.setDaemon(true);
        t1.start();
        t2.start();
        Thread.sleep(300);
        ThreadMXBean mx = ManagementFactory.getThreadMXBean();
        long[] ids = mx.findDeadlockedThreads(); // lo mismo que reporta jstack: "Found one Java-level deadlock"
        if (ids != null) {
            for (ThreadInfo ti : mx.getThreadInfo(ids)) System.out.printf("  🔒 %s espera %s, que tiene %s%n", ti.getThreadName(), ti.getLockName(), ti.getLockOwnerName());
        }
        System.out.println("  Arreglo: adquirir siempre en el mismo orden (p. ej. por id de cuenta) o tryLock con timeout.");
        ReentrantLock c = new ReentrantLock(), d = new ReentrantLock();
        Thread t3 = new Thread(() -> transferOrdered(c, d, 1, 2));
        Thread t4 = new Thread(() -> transferOrdered(d, c, 2, 1));
        t3.start(); t4.start(); t3.join(2000); t4.join(2000);
        System.out.println("  Con orden global: " + (!t3.isAlive() && !t4.isAlive() ? "ambas transferencias terminaron ✅" : "siguen bloqueadas ❌"));

        System.out.println("\n=== 4) Hilos virtuales (Java 21+) ===");
        try {
            ExecutorService vt = (ExecutorService) Executors.class.getMethod("newVirtualThreadPerTaskExecutor").invoke(null);
            long ms = runTasks(vt, 2000);
            System.out.printf("  2000 tareas de I/O con un hilo virtual por tarea → %d ms. Ideales para I/O bloqueante; no para CPU.%n", ms);
            System.out.println("  Ojo: siguen necesitando límites (p. ej. un Semaphore del tamaño del pool de conexiones a la BD).");
        } catch (NoSuchMethodException e) {
            System.out.println("  Tu JDK es anterior a 21: los hilos virtuales no están disponibles (Executors.newVirtualThreadPerTaskExecutor).");
        }
    }

    static void transfer(ReentrantLock from, ReentrantLock to) {
        from.lock();
        try {
            sleep(100);
            to.lock(); // espera para siempre si el otro hilo tiene 'to' y espera 'from'
            to.unlock();
        } finally {
            from.unlock();
        }
    }

    static void transferOrdered(ReentrantLock x, ReentrantLock y, int idX, int idY) {
        ReentrantLock first = idX < idY ? x : y, second = idX < idY ? y : x;
        first.lock();
        try { sleep(100); second.lock(); second.unlock(); } finally { first.unlock(); }
    }

    static void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
