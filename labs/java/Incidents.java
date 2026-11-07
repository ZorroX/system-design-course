import java.lang.management.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

/**
 * Simulador de incidentes para PRACTICAR diagnóstico con las herramientas reales de la JVM.
 *
 *   java Incidents.java              → autodiagnóstico rápido de los 4 incidentes (termina solo)
 *   java Incidents.java cpu          → hilo al 100% (regex catastrófica)      → practica top -H, printf %x, jstack
 *   java Incidents.java leak         → fuga en un HashMap estático            → jstat -gcutil, jcmd GC.class_histogram, GC.heap_dump
 *   java Incidents.java deadlock     → dos hilos bloqueados                   → jstack (al final: "Found one Java-level deadlock")
 *   java Incidents.java pool         → hilos esperando un "pool de conexiones" → jstack (WAITING en Semaphore.acquire)
 *
 * En otra terminal:  jps -l   (para ver el PID)   y luego los comandos de arriba.
 */
public class Incidents {

    // (a+)+$ con una entrada que casi coincide: backtracking exponencial
    static final Pattern EVIL = Pattern.compile("^(a+)+$");
    static final Map<String, byte[]> RESPONSES = new ConcurrentHashMap<>(); // "caché" sin expiración = fuga

    public static void main(String[] args) throws Exception {
        String mode = args.length > 0 ? args[0] : "selftest";
        long pid = ProcessHandle.current().pid();
        switch (mode) {
            case "cpu" -> { System.out.println("PID " + pid + " · hilo caliente 'http-nio-8080-exec-17'. Prueba: top -H -p " + pid); startCpu(); block(); }
            case "leak" -> { System.out.println("PID " + pid + " · la memoria crece. Prueba: jstat -gcutil " + pid + " 1000"); startLeak(Long.MAX_VALUE); block(); }
            case "deadlock" -> { System.out.println("PID " + pid + " · Prueba: jstack " + pid + " | tail -n 30"); startDeadlock(); block(); }
            case "pool" -> { System.out.println("PID " + pid + " · Prueba: jstack " + pid + " | grep -A 4 WAITING"); startPool(); block(); }
            default -> selftest();
        }
    }

    static void selftest() throws Exception {
        ThreadMXBean mx = ManagementFactory.getThreadMXBean();
        MemoryMXBean mem = ManagementFactory.getMemoryMXBean();

        System.out.println("=== Incidente 1: CPU al 100% ===");
        Thread hot = startCpu();
        Thread.sleep(800);
        // equivalente a top -H: CPU consumida por cada hilo
        long best = 0; String name = "?";
        for (long id : mx.getAllThreadIds()) {
            long cpu = mx.getThreadCpuTime(id);
            ThreadInfo ti = mx.getThreadInfo(id, 8);
            if (ti != null && cpu > best) { best = cpu; name = ti.getThreadName(); }
        }
        ThreadInfo info = mx.getThreadInfo(hot.getId(), 6);
        System.out.printf("  Hilo más caliente: %s (%d ms de CPU)%n", name, best / 1_000_000);
        for (StackTraceElement e : info.getStackTrace()) System.out.println("    at " + e);
        System.out.println("  → Causa: regex con cuantificadores anidados. Arreglo: reescribirla y limitar la longitud de la entrada.");

        System.out.println("\n=== Incidente 2: fuga de memoria ===");
        System.gc();
        long before = mem.getHeapMemoryUsage().getUsed();
        startLeak(60_000);
        System.gc();
        long after = mem.getHeapMemoryUsage().getUsed();
        System.out.printf("  Heap usado tras GC: %d MB → %d MB · RESPONSES tiene %,d entradas que nunca se borran%n", before >> 20, after >> 20, RESPONSES.size());
        System.out.println("  → jcmd PID GC.class_histogram mostraría byte[] y ConcurrentHashMap$Node arriba; MAT señalaría el campo estático.");
        System.out.println("  → Arreglo: caché acotada con TTL (Caffeine: maximumSize + expireAfterWrite) o Redis con EX.");
        RESPONSES.clear();

        System.out.println("\n=== Incidente 3: deadlock ===");
        startDeadlock();
        Thread.sleep(300);
        long[] ids = mx.findDeadlockedThreads();
        if (ids != null) for (ThreadInfo ti : mx.getThreadInfo(ids)) System.out.printf("  %s espera %s (lo tiene %s)%n", ti.getThreadName(), ti.getLockName(), ti.getLockOwnerName());

        System.out.println("\n=== Incidente 4: pool de conexiones agotado ===");
        startPool();
        Thread.sleep(300);
        int waiting = 0;
        for (ThreadInfo ti : mx.dumpAllThreads(false, false))
            if (ti.getThreadName().startsWith("http-exec") && (ti.getThreadState() == Thread.State.WAITING || ti.getThreadState() == Thread.State.TIMED_WAITING)) waiting++;
        System.out.printf("  %d hilos HTTP esperando conexión; las 4 conexiones las retiene una consulta lenta (Seq Scan).%n", waiting);
        System.out.println("  → Arreglo: el índice correcto, no un pool más grande.");
        System.out.println("\nAhora repítelo de verdad: java Incidents.java cpu  (y en otra terminal: jps, top -H, jstack…)");
        System.exit(0);
    }

    static Thread startCpu() {
        Thread t = new Thread(() -> {
            String input = "a".repeat(32) + "!";
            while (!Thread.currentThread().isInterrupted()) EVIL.matcher(input).matches();
        }, "http-nio-8080-exec-17");
        t.setDaemon(true);
        t.start();
        return t;
    }

    static void startLeak(long max) {
        for (long i = 0; i < max; i++) {
            RESPONSES.put("idem-" + i, new byte[512]);
            if (max == Long.MAX_VALUE && i % 1000 == 0) sleep(5);
        }
    }

    static void startDeadlock() {
        Object accountA = new Object(), accountB = new Object();
        Thread t1 = new Thread(() -> { synchronized (accountA) { sleep(100); synchronized (accountB) { } } }, "transfer-worker-3");
        Thread t2 = new Thread(() -> { synchronized (accountB) { sleep(100); synchronized (accountA) { } } }, "transfer-worker-7");
        t1.setDaemon(true); t2.setDaemon(true);
        t1.start(); t2.start();
    }

    static void startPool() {
        Semaphore connections = new Semaphore(4); // como HikariCP con maximum-pool-size=4
        for (int i = 0; i < 20; i++) {
            Thread t = new Thread(() -> {
                try {
                    connections.acquire();
                    try { Thread.sleep(60_000); } finally { connections.release(); } // "consulta" de 60 s
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }, "http-exec-" + i);
            t.setDaemon(true);
            t.start();
        }
    }

    static void block() throws InterruptedException { new CountDownLatch(1).await(); }

    static void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } }
}
