import java.util.*;

/**
 * Pagos con timeouts "en el último milisegundo": estrategia ingenua vs. segura.
 * Ejecuta (Java 17+):  java PaymentFlow.java
 *
 * - El adquirente cobra y a veces la respuesta se pierde (timeout): el cobro SÍ ocurrió.
 * - Ingenua: timeout → FALLIDO → el cliente reintenta con referencia nueva → doble cargo.
 * - Segura: misma referencia (idempotencia en el adquirente), estado PENDIENTE, consulta de estado,
 *   ledger de doble partida en centavos y conciliación final contra el archivo del adquirente.
 */
public class PaymentFlow {

    enum Status { PENDING, CAPTURED, FAILED }

    /** Banco adquirente simulado: deduplica por referencia (como Idempotency-Key). */
    static final class Acquirer {
        final Map<String, Long> settled = new LinkedHashMap<>(); // archivo de liquidación
        final Random rnd = new Random(42);
        int calls;

        /** Devuelve true si cobró. Timeout: o la petición nunca llegó, o cobró y la respuesta se perdió. */
        boolean charge(String ref, long cents) throws Timeout {
            calls++;
            double r = rnd.nextDouble();
            if (r < 0.12) throw new Timeout();               // la petición se perdió: NO cobró
            settled.putIfAbsent(ref, cents);                 // el cobro ocurre (idempotente por ref)
            if (r < 0.32) throw new Timeout();               // cobró, pero la respuesta se perdió
            return true;
        }

        /** Consulta de estado; a veces el adquirente tampoco contesta. */
        Optional<Long> status(String ref) throws Unavailable {
            if (rnd.nextDouble() < 0.45) throw new Unavailable();
            return Optional.ofNullable(settled.get(ref));
        }
    }

    static final class Timeout extends Exception {}
    static final class Unavailable extends Exception {}

    /** Ledger de doble partida: cada movimiento son 2 asientos que suman cero. */
    static final class Ledger {
        final List<long[]> entries = new ArrayList<>(); // [cuenta, centavos]
        static final int CLIENTE = 0, COMERCIO = 1;

        void post(long cents) {
            entries.add(new long[]{CLIENTE, -cents});
            entries.add(new long[]{COMERCIO, cents});
        }

        long balance(int acc) { return entries.stream().filter(e -> e[0] == acc).mapToLong(e -> e[1]).sum(); }
        long sum() { return entries.stream().mapToLong(e -> e[1]).sum(); }
    }

    record Order(String id, long cents) {}

    public static void main(String[] args) {
        List<Order> orders = new ArrayList<>();
        for (int i = 1; i <= 40; i++) orders.add(new Order("ord-" + i, 1_000 + i * 25L));
        long expected = orders.stream().mapToLong(Order::cents).sum();

        // ---------------- Ingenua ----------------
        Acquirer a1 = new Acquirer();
        for (Order o : orders) {
            int attempt = 0;
            while (true) {
                String ref = o.id() + "-try" + (++attempt);    // ¡referencia nueva en cada intento!
                try { a1.charge(ref, o.cents()); break; }     // timeout → "falló" → el cliente vuelve a pagar
                catch (Timeout t) { /* marcado FAILED */ }
            }
        }
        long charged1 = a1.settled.values().stream().mapToLong(Long::longValue).sum();
        System.out.println("=== Estrategia ingenua (timeout = fallido, reintento con referencia nueva) ===");
        System.out.printf("  Esperado: $%,.2f · Cobrado por el banco: $%,.2f · DOBLES CARGOS: $%,.2f%n%n",
                expected / 100.0, charged1 / 100.0, (charged1 - expected) / 100.0);

        // ---------------- Segura ----------------
        Acquirer a2 = new Acquirer();
        Map<String, Status> payments = new LinkedHashMap<>();
        Ledger ledger = new Ledger();
        int pendingAfterSync = 0;
        for (Order o : orders) {
            String ref = o.id();                                // la MISMA referencia en todos los intentos
            payments.put(ref, Status.PENDING);                  // INSERT ... (UNIQUE ref) en la misma tx que el outbox
            for (int attempt = 1; attempt <= 2 && payments.get(ref) == Status.PENDING; attempt++) {
                try {
                    a2.charge(ref, o.cents());
                    payments.put(ref, Status.CAPTURED);
                } catch (Timeout t) {
                    // NO sabemos si cobró: consultamos con la misma referencia
                    try {
                        if (a2.status(ref).isPresent()) payments.put(ref, Status.CAPTURED);
                        // no está: la petición nunca llegó → reintentar con la MISMA referencia es seguro
                    } catch (Unavailable u) { /* seguimos sin saber: otro intento o conciliación */ }
                }
            }
            if (payments.get(ref) == Status.CAPTURED) ledger.post(o.cents());
            else pendingAfterSync++;                            // queda PENDIENTE para la conciliación
        }
        // Conciliación (T+1): comparar nuestro estado con el archivo de liquidación del adquirente
        int fixed = 0, failed = 0;
        for (Order o : orders) {
            if (payments.get(o.id()) != Status.PENDING) continue;
            Long cents = a2.settled.get(o.id());
            if (cents != null) { payments.put(o.id(), Status.CAPTURED); ledger.post(cents); fixed++; }
            else { payments.put(o.id(), Status.FAILED); failed++; } // ahora sí es seguro decir "falló, reintenta"
        }
        long charged2 = a2.settled.values().stream().mapToLong(Long::longValue).sum();
        System.out.println("=== Estrategia segura (misma referencia + PENDIENTE + consulta + conciliación) ===");
        System.out.printf("  Llamadas al adquirente: %d · pendientes tras los reintentos: %d · conciliación: %d capturados, %d fallidos de verdad%n", a2.calls, pendingAfterSync, fixed, failed);
        long capturedCents = orders.stream().filter(o -> payments.get(o.id()) == Status.CAPTURED).mapToLong(Order::cents).sum();
        expected = capturedCents;
        System.out.printf("  Esperado: $%,.2f · Cobrado: $%,.2f · Dobles cargos: $%,.2f%n", expected / 100.0, charged2 / 100.0, (charged2 - expected) / 100.0);
        System.out.printf("  Ledger: comercio $%,.2f · cliente $%,.2f · suma de asientos = %d (siempre 0)%n",
                ledger.balance(Ledger.COMERCIO) / 100.0, ledger.balance(Ledger.CLIENTE) / 100.0, ledger.sum());
        System.out.println("\nReglas: dinero en centavos (long), nunca double · timeout ≠ fallido · la misma clave en cada reintento ·");
        System.out.println("        UNIQUE en la base (no SELECT-luego-INSERT) · outbox para eventos · conciliación diaria.");
    }
}
