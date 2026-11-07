import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Idempotency keys para una API de pagos (patrón Stripe).
 * Ejecuta (Java 17+):  java Idempotency.java
 *
 * En Spring Boot lo implementarías como un HandlerInterceptor o filtro que lee
 * el header Idempotency-Key y usa Redis (SET key NX EX 86400) o una tabla con UNIQUE(key).
 */
public class Idempotency {

    record Response(int status, Map<String, Object> body) {}

    static final class Entry {
        final String requestHash;
        volatile Response response; // null => en curso
        Entry(String h) { requestHash = h; }
    }

    static final class PaymentsApi {
        private final ConcurrentHashMap<String, Entry> store = new ConcurrentHashMap<>();
        final List<Map<String, Object>> charges = Collections.synchronizedList(new ArrayList<>());

        Response postCharge(String idempotencyKey, long amount, String currency) {
            if (idempotencyKey == null) return new Response(400, Map.of("error", "Idempotency-Key requerido"));
            String hash = sha256(amount + "|" + currency);

            Entry fresh = new Entry(hash);
            Entry prior = store.putIfAbsent(idempotencyKey, fresh); // atómico, como SET NX
            if (prior != null) {
                if (!prior.requestHash.equals(hash)) return new Response(422, Map.of("error", "payload distinto"));
                if (prior.response == null) return new Response(409, Map.of("error", "en curso"));
                Map<String, Object> replay = new LinkedHashMap<>(prior.response.body());
                replay.put("replayed", true);
                return new Response(prior.response.status(), replay);
            }

            Map<String, Object> charge = new LinkedHashMap<>();
            charge.put("id", "ch_" + UUID.randomUUID().toString().substring(0, 8));
            charge.put("amount", amount);
            charges.add(charge);                       // efecto secundario real
            fresh.response = new Response(201, charge);
            return fresh.response;
        }

        private static String sha256(String s) {
            try {
                byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
                return HexFormat.of().formatHex(d);
            } catch (Exception e) { throw new IllegalStateException(e); }
        }
    }

    public static void main(String[] args) {
        PaymentsApi api = new PaymentsApi();
        String key = UUID.randomUUID().toString();
        Response first = api.postCharge(key, 4999, "usd");
        Response retry = api.postCharge(key, 4999, "usd");
        System.out.println("1er intento: " + first);
        System.out.println("reintento  : " + retry);
        if (api.charges.size() != 1) throw new AssertionError("cobro duplicado");

        Response bad = api.postCharge(key, 1, "usd");
        System.out.println("misma clave, otro payload: " + bad);
        if (bad.status() != 422) throw new AssertionError("debe rechazar");
        System.out.println("OK - un solo cobro pese al reintento");
    }
}
