import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

/**
 * Circuit Breaker + Retry con backoff exponencial y full jitter.
 * Ejecuta (Java 17+):  java CircuitBreaker.java
 *
 * En Spring Boot usarías Resilience4j:
 *   @CircuitBreaker(name = "payments", fallbackMethod = "queueForLater")
 *   @Retry(name = "payments")
 */
public class CircuitBreaker {

    enum State { CLOSED, OPEN, HALF_OPEN }

    static final class CircuitOpenException extends RuntimeException {
        CircuitOpenException() { super("circuito abierto: fail fast"); }
    }

    static final class Breaker {
        private final double failureThreshold;
        private final int window, halfOpenProbes;
        private final long openMillis;
        private final LongSupplier clock;
        private final Deque<Boolean> results = new ArrayDeque<>();
        private State state = State.CLOSED;
        private long openedAt;
        private int probeSuccesses;

        Breaker(double failureThreshold, int window, long openMillis, int halfOpenProbes, LongSupplier clock) {
            this.failureThreshold = failureThreshold; this.window = window;
            this.openMillis = openMillis; this.halfOpenProbes = halfOpenProbes; this.clock = clock;
        }

        synchronized State state() { return state; }

        <T> T call(Supplier<T> fn, Supplier<T> fallback) {
            synchronized (this) {
                if (state == State.OPEN) {
                    if (clock.getAsLong() - openedAt >= openMillis) transition(State.HALF_OPEN);
                    else if (fallback != null) return fallback.get();
                    else throw new CircuitOpenException();
                }
            }
            try {
                T r = fn.get();
                onResult(true);
                return r;
            } catch (RuntimeException e) {
                onResult(false);
                if (fallback != null) return fallback.get();
                throw e;
            }
        }

        private synchronized void onResult(boolean ok) {
            if (state == State.HALF_OPEN) {
                if (!ok) transition(State.OPEN);
                else if (++probeSuccesses >= halfOpenProbes) transition(State.CLOSED);
                return;
            }
            results.addLast(ok);
            if (results.size() > window) results.removeFirst();
            if (results.size() == window) {
                long failures = results.stream().filter(b -> !b).count();
                if ((double) failures / window >= failureThreshold) transition(State.OPEN);
            }
        }

        private void transition(State to) {
            System.out.println("  [breaker] " + state + " -> " + to);
            state = to;
            if (to == State.OPEN) openedAt = clock.getAsLong();
            results.clear();
            probeSuccesses = 0;
        }
    }

    interface Sleeper { void sleep(long millis); }

    /** Full jitter: espera = random(0, min(cap, base * 2^n)). Solo para operaciones idempotentes. */
    static <T> T retryWithBackoff(Supplier<T> fn, int attempts, long baseMs, long capMs, Sleeper sleeper) {
        for (int attempt = 0; ; attempt++) {
            try {
                return fn.get();
            } catch (RuntimeException e) {
                if (attempt == attempts - 1) throw e;
                long ceiling = Math.min(capMs, baseMs * (1L << attempt));
                sleeper.sleep(ThreadLocalRandom.current().nextLong(ceiling + 1));
            }
        }
    }

    public static void main(String[] args) {
        long[] now = {0};
        Breaker cb = new Breaker(0.5, 4, 5_000, 2, () -> now[0]);
        boolean[] healthy = {false};
        Supplier<String> payments = () -> {
            if (!healthy[0]) throw new IllegalStateException("timeout");
            return "pago OK";
        };
        Supplier<String> fallback = () -> "encolado para reintentar luego";

        System.out.println("1) Servicio cae:");
        for (int i = 0; i < 4; i++) cb.call(payments, fallback);
        check(cb.state() == State.OPEN, "debe abrir");
        System.out.println("   con circuito abierto -> " + cb.call(payments, fallback));

        System.out.println("2) Pasan 5s y el servicio vuelve:");
        now[0] = 5_000;
        healthy[0] = true;
        System.out.println("   " + cb.call(payments, null) + " | " + cb.call(payments, null));
        check(cb.state() == State.CLOSED, "debe cerrar");

        System.out.println("3) Retry con backoff + jitter:");
        int[] calls = {0};
        List<Long> waits = new ArrayList<>();
        String r = retryWithBackoff(() -> {
            if (++calls[0] < 3) throw new IllegalStateException("timeout");
            return "ok al 3er intento";
        }, 5, 100, 2_000, waits::add);
        System.out.println("   " + r + " esperas(ms): " + waits);
        System.out.println("OK");
    }

    static void check(boolean c, String m) { if (!c) throw new AssertionError(m); }
}
