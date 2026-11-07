import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Lost update, bloqueo pesimista y bloqueo optimista sobre el saldo de una cuenta.
 * Ejecuta (Java 17+):  java Locking.java
 *
 * Equivalentes en SQL / JPA:
 *   pesimista  → SELECT ... FOR UPDATE  ·  @Lock(LockModeType.PESSIMISTIC_WRITE)
 *   optimista  → UPDATE ... SET saldo=?, version=version+1 WHERE id=? AND version=?  ·  @Version
 *   atómico    → UPDATE cuentas SET saldo = saldo - :monto WHERE id = :id AND saldo >= :monto
 */
public class Locking {

    static final int THREADS = 8, OPS = 2_000; // 8 hilos × 2.000 retiros de 1 centavo

    // ---- 1) Sin control: leer-modificar-escribir ----
    static long unsafeBalance;

    // ---- 2) Pesimista: un candado por cuenta ----
    static long lockedBalance;
    static final Object ROW_LOCK = new Object();

    // ---- 3) Optimista: versión + compare-and-set con reintentos ----
    record Row(long balance, long version) {}
    static final AtomicReference<Row> ROW = new AtomicReference<>();
    static final AtomicInteger RETRIES = new AtomicInteger();

    static void run(Runnable op) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        for (int t = 0; t < THREADS; t++)
            pool.execute(() -> {
                try { start.await(); } catch (InterruptedException e) { return; }
                for (int i = 0; i < OPS; i++) op.run();
            });
        start.countDown();
        pool.shutdown();
        pool.awaitTermination(30, TimeUnit.SECONDS);
    }

    public static void main(String[] args) throws Exception {
        long initial = 1_000_000;
        long expected = initial - (long) THREADS * OPS;
        System.out.printf("Saldo inicial %,d · %d hilos × %,d retiros de 1 · saldo esperado %,d%n%n", initial, THREADS, OPS, expected);

        unsafeBalance = initial;
        run(() -> {
            long read = unsafeBalance;   // SELECT saldo
            Thread.onSpinWait();
            unsafeBalance = read - 1;    // UPDATE saldo = ?  (pisa lo que otro escribió)
        });
        System.out.printf("1) Sin bloqueo      → %,d  (%,d retiros PERDIDOS: lost update)%n", unsafeBalance, unsafeBalance - expected);

        lockedBalance = initial;
        long t0 = System.nanoTime();
        run(() -> { synchronized (ROW_LOCK) { lockedBalance -= 1; } });
        System.out.printf("2) Pesimista        → %,d  ✔ en %d ms (cada uno espera su turno)%n", lockedBalance, (System.nanoTime() - t0) / 1_000_000);

        ROW.set(new Row(initial, 0));
        t0 = System.nanoTime();
        run(() -> {
            while (true) {
                Row cur = ROW.get();                                   // SELECT saldo, version
                Row next = new Row(cur.balance() - 1, cur.version() + 1);
                if (ROW.compareAndSet(cur, next)) break;               // UPDATE ... WHERE version = ?  (1 fila afectada)
                RETRIES.incrementAndGet();                             // 0 filas → OptimisticLockException → reintentar
            }
        });
        System.out.printf("3) Optimista        → %,d  ✔ en %d ms con %,d reintentos (versión final %,d)%n%n",
                ROW.get().balance(), (System.nanoTime() - t0) / 1_000_000, RETRIES.get(), ROW.get().version());

        System.out.println("¿Cuál elegir?");
        System.out.println("  · Baja contención (la mayoría de las cuentas, edición de perfiles): OPTIMISTA. Sin esperas; reintentas rara vez.");
        System.out.println("  · Alta contención (la cuenta de un comercio enorme, el último asiento): PESIMISTA o una cola por clave.");
        System.out.println("  · Para un simple descuento: UPDATE atómico con condición (saldo >= monto). Lo más simple (KISS).");
        System.out.println("  · Para evitar deadlocks con varios FOR UPDATE: bloquea siempre en el mismo orden (por id).");
    }
}
