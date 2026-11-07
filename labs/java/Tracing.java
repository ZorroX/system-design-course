import java.security.SecureRandom;
import java.util.*;
import java.util.function.Supplier;

/**
 * Mini tracing distribuido + métricas RED, al estilo OpenTelemetry.
 * Ejecuta (Java 17+):  java Tracing.java
 *
 * En producción: el agente de OpenTelemetry para Java (-javaagent:opentelemetry-javaagent.jar)
 * instrumenta Spring, JDBC, HTTP clients y Kafka sin tocar tu código; Micrometer exporta métricas.
 */
public class Tracing {

    static final SecureRandom RND = new SecureRandom();
    static String hex(int bytes) { byte[] b = new byte[bytes]; RND.nextBytes(b); return HexFormat.of().formatHex(b); }

    static final class Span {
        final String name, service, traceId, spanId = hex(8), parentId;
        final long start = System.nanoTime();
        long end; String error;
        Span(String name, String service, String traceId, String parentId) {
            this.name = name; this.service = service; this.traceId = traceId; this.parentId = parentId;
        }
        double ms() { return (end - start) / 1e6; }
    }

    /** El span "actual" por hilo (OpenTelemetry usa Context + ThreadLocal; con virtual threads también funciona). */
    static final ThreadLocal<Span> CURRENT = new ThreadLocal<>();
    static final List<Span> FINISHED = new ArrayList<>();
    static final Map<String, List<Double>> LAT = new TreeMap<>();
    static final Map<String, Integer> ERR = new HashMap<>();

    static <T> T inSpan(String name, String service, String traceparent, Supplier<T> body) {
        Span parent = CURRENT.get();
        String traceId, parentId;
        if (traceparent != null) { String[] p = traceparent.split("-"); traceId = p[1]; parentId = p[2]; }
        else if (parent != null) { traceId = parent.traceId; parentId = parent.spanId; }
        else { traceId = hex(16); parentId = null; }
        Span s = new Span(name, service, traceId, parentId);
        CURRENT.set(s);
        try {
            return body.get();
        } catch (RuntimeException e) {
            s.error = e.getMessage();
            throw e;
        } finally {
            s.end = System.nanoTime();
            CURRENT.set(parent);
            FINISHED.add(s);
            LAT.computeIfAbsent(service, k -> new ArrayList<>()).add(s.ms());
            if (s.error != null) ERR.merge(service, 1, Integer::sum);
        }
    }

    /** Header W3C que un cliente HTTP instrumentado inyecta en la petición saliente. */
    static String traceparent() { Span s = CURRENT.get(); return "00-" + s.traceId + "-" + s.spanId + "-01"; }

    static void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException e) { throw new RuntimeException(e); } }

    // --------- servicios simulados ---------
    static final Random R = new Random(3);
    static Void payments(String tp) {
        return inSpan("POST /charge", "payments", tp, () -> {
            sleep(R.nextInt(10) == 0 ? 30 : 2);            // 10% lentas
            if (R.nextInt(20) == 0) throw new IllegalStateException("card declined upstream");
            return null;
        });
    }
    static Void inventory(String tp) {
        return inSpan("POST /reserve", "inventory", tp, () ->
                inSpan("SELECT stock", "inventory-db", null, () -> { sleep(3); return null; }));
    }
    static Void orders(String tp) {
        return inSpan("POST /orders", "orders", tp, () -> { inventory(traceparent()); payments(traceparent()); return null; });
    }
    static String gateway() {
        return inSpan("POST /checkout", "gateway", null, () -> {
            try { orders(traceparent()); } catch (IllegalStateException e) { /* responde 502 */ }
            return CURRENT.get().traceId;
        });
    }

    static void waterfall(String traceId) {
        List<Span> spans = FINISHED.stream().filter(s -> s.traceId.equals(traceId))
                .sorted(Comparator.comparingLong(s -> s.start)).toList();
        long t0 = spans.get(0).start, total = spans.stream().mapToLong(s -> s.end).max().orElseThrow() - t0;
        Map<String, Integer> depth = new HashMap<>();
        for (Span s : spans) {
            int d = s.parentId == null ? 0 : depth.getOrDefault(s.parentId, 0) + 1;
            depth.put(s.spanId, d);
            int off = (int) ((s.start - t0) * 40 / total), w = Math.max(1, (int) ((s.end - s.start) * 40 / total));
            String bar = " ".repeat(off) + (s.error != null ? "X" : "#").repeat(w);
            System.out.printf("%-32s |%-41s| %6.1f ms%n", "  ".repeat(d) + s.service + " " + s.name, bar, s.ms());
        }
    }

    public static void main(String[] args) {
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 200; i++) ids.add(gateway());
        String slowest = ids.stream().max(Comparator.comparingDouble(t -> FINISHED.stream()
                .filter(s -> s.traceId.equals(t) && s.parentId == null).findFirst().orElseThrow().ms())).orElseThrow();
        System.out.println("Trace más lento (waterfall):");
        waterfall(slowest);

        System.out.printf("%n%-12s%6s%7s%9s%9s%n", "servicio", "rate", "err%", "p50", "p99");
        LAT.forEach((svc, xs) -> {
            List<Double> s = new ArrayList<>(xs); Collections.sort(s);
            System.out.printf("%-12s%6d%6.1f%%%7.1fms%7.1fms%n", svc, s.size(), 100.0 * ERR.getOrDefault(svc, 0) / s.size(),
                    s.get(s.size() / 2), s.get(Math.min(s.size() - 1, (int) (s.size() * 0.99))));
        });

        long n = FINISHED.stream().filter(s -> s.traceId.equals(slowest)).count();
        long roots = FINISHED.stream().filter(s -> s.traceId.equals(slowest) && s.parentId == null).count();
        if (roots != 1 || n != 5) throw new AssertionError("el trace debe ser un árbol de 5 spans");
        System.out.println("OK");
    }
}
