import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Rate limiting: Token Bucket y Sliding Window Counter, por cliente.
 * Ejecuta (Java 17+):  java RateLimiter.java
 *
 * En producción: Bucket4j o Resilience4j RateLimiter, con estado en Redis
 * (script Lua atómico) para que todos los nodos compartan el límite.
 */
public class RateLimiter {

    static final class TokenBucket {
        private final double capacity, refillPerNano;
        private final LongSupplier clock;
        private double tokens;
        private long last;

        TokenBucket(double capacity, double refillPerSecond, LongSupplier nanoClock) {
            this.capacity = capacity;
            this.refillPerNano = refillPerSecond / 1e9;
            this.clock = nanoClock;
            this.tokens = capacity;
            this.last = nanoClock.getAsLong();
        }

        synchronized boolean tryAcquire() {
            long now = clock.getAsLong();
            tokens = Math.min(capacity, tokens + (now - last) * refillPerNano); // recarga perezosa
            last = now;
            if (tokens >= 1) { tokens -= 1; return true; }
            return false;
        }
    }

    static final class SlidingWindowCounter {
        private final int limit;
        private final long windowNanos;
        private final LongSupplier clock;
        private long curStart;
        private int cur, prev;

        SlidingWindowCounter(int limit, long windowNanos, LongSupplier clock) {
            this.limit = limit; this.windowNanos = windowNanos; this.clock = clock;
            this.curStart = clock.getAsLong();
        }

        synchronized boolean tryAcquire() {
            long now = clock.getAsLong();
            long elapsed = (now - curStart) / windowNanos;
            if (elapsed >= 1) {
                prev = elapsed == 1 ? cur : 0;
                cur = 0;
                curStart += elapsed * windowNanos;
            }
            double overlap = 1.0 - (double) (now - curStart) / windowNanos;
            if (cur + prev * overlap < limit) { cur++; return true; }
            return false;
        }
    }

    /** Un bucket por API key: así se limita por cliente, no globalmente. */
    static final class PerClientLimiter {
        private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();
        private final double capacity, rate;
        private final LongSupplier clock;
        PerClientLimiter(double capacity, double rate, LongSupplier clock) {
            this.capacity = capacity; this.rate = rate; this.clock = clock;
        }
        /** Devuelve el status HTTP que respondería el gateway. */
        int handle(String apiKey) {
            return buckets.computeIfAbsent(apiKey, k -> new TokenBucket(capacity, rate, clock)).tryAcquire() ? 200 : 429;
        }
    }

    public static void main(String[] args) {
        long[] now = {0};
        LongSupplier fake = () -> now[0];
        long sec = 1_000_000_000L;

        TokenBucket tb = new TokenBucket(5, 1, fake);
        List<Boolean> burst = new ArrayList<>();
        for (int i = 0; i < 7; i++) burst.add(tb.tryAcquire());
        System.out.println("Token bucket, ráfaga de 7: " + burst);
        check(burst.stream().filter(b -> b).count() == 5, "capacidad 5");
        now[0] = 2 * sec;
        check(tb.tryAcquire() && tb.tryAcquire() && !tb.tryAcquire(), "2 tokens tras 2s");

        now[0] = 0;
        SlidingWindowCounter sw = new SlidingWindowCounter(10, 60 * sec, fake);
        for (int i = 0; i < 10; i++) check(sw.tryAcquire(), "dentro del límite");
        check(!sw.tryAcquire(), "excede el límite");
        now[0] = 90 * sec;
        int allowed = 0;
        for (int i = 0; i < 10; i++) if (sw.tryAcquire()) allowed++;
        System.out.println("Sliding window: permitidas a mitad de la ventana siguiente = " + allowed);
        check(allowed == 5, "anterior pesa 50%");

        PerClientLimiter gw = new PerClientLimiter(2, 1, fake);
        System.out.println("Cliente A: " + gw.handle("A") + " " + gw.handle("A") + " " + gw.handle("A")
                + " | Cliente B: " + gw.handle("B"));
        System.out.println("OK");
    }

    static void check(boolean c, String m) { if (!c) throw new AssertionError(m); }
}
