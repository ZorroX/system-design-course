import java.util.*;

/**
 * Saga orquestada con compensaciones (checkout de e-commerce).
 * Ejecuta (Java 17+):  java Saga.java
 *
 * Cada servicio tiene su propia base de datos: no hay transacción ACID global.
 * Si un paso falla, se ejecutan las compensaciones de los pasos completados en orden inverso.
 * En producción: Temporal, AWS Step Functions, Camunda o una tabla saga_state + outbox.
 */
public class Saga {

    static final class StepFailed extends RuntimeException { StepFailed(String m) { super(m); } }

    // --------- servicios con su estado local ---------
    static final class Inventory {
        final Map<String, Integer> stock = new HashMap<>(Map.of("sku-1", 5));
        final Map<String, Integer> reservations = new HashMap<>();
        boolean fail;
        void reserve(String sagaId, int qty) {
            if (reservations.containsKey(sagaId)) return;                 // idempotente
            if (fail || stock.get("sku-1") < qty) throw new StepFailed("sin stock");
            stock.merge("sku-1", -qty, Integer::sum);
            reservations.put(sagaId, qty);
        }
        void release(String sagaId) {                                      // compensación
            Integer qty = reservations.remove(sagaId);
            if (qty != null) stock.merge("sku-1", qty, Integer::sum);
        }
    }

    static final class Payments {
        final Map<String, Integer> charges = new HashMap<>();
        final Set<String> refunds = new HashSet<>();
        boolean fail;
        void charge(String sagaId, int amount) {
            if (charges.containsKey(sagaId)) return;                       // sin esto, el reintento cobra dos veces
            if (fail) throw new StepFailed("tarjeta rechazada");
            charges.put(sagaId, amount);
        }
        void refund(String sagaId) { if (charges.containsKey(sagaId)) refunds.add(sagaId); }
    }

    static final class Shipping {
        final Set<String> shipments = new HashSet<>();
        boolean fail;
        void schedule(String sagaId) {
            if (fail) throw new StepFailed("sin transportista disponible");
            shipments.add(sagaId);
        }
    }

    static final class Orders {
        final Map<String, String> status = new HashMap<>();
        void create(String id) { status.putIfAbsent(id, "PENDING"); }
        void cancel(String id) { status.put(id, "CANCELLED"); }
        void approve(String id) { status.put(id, "APPROVED"); }
    }

    // --------- orquestador ---------
    record Step(String name, Runnable action, Runnable compensation) {}

    static final class Orchestrator {
        final List<String> log = new ArrayList<>();
        boolean run(List<Step> steps) {
            Deque<Step> done = new ArrayDeque<>();
            for (Step s : steps) {
                try {
                    s.action().run();
                    done.push(s);                                          // pila: se compensa en orden inverso
                    log.add("OK " + s.name());
                } catch (StepFailed e) {
                    log.add("FALLA " + s.name() + ": " + e.getMessage());
                    while (!done.isEmpty()) {
                        Step prev = done.pop();
                        if (prev.compensation() != null) { prev.compensation().run(); log.add("compensar " + prev.name()); }
                    }
                    return false;
                }
            }
            return true;
        }
    }

    record Services(Orders orders, Inventory inventory, Payments payments, Shipping shipping) {
        static Services create() { return new Services(new Orders(), new Inventory(), new Payments(), new Shipping()); }
    }

    static Orchestrator checkout(String id, Services s) {
        Orchestrator o = new Orchestrator();
        o.run(List.of(
                new Step("crear pedido", () -> s.orders().create(id), () -> s.orders().cancel(id)),
                new Step("reservar stock", () -> s.inventory().reserve(id, 2), () -> s.inventory().release(id)),
                new Step("cobrar", () -> s.payments().charge(id, 4999), () -> s.payments().refund(id)),
                new Step("programar envío", () -> s.shipping().schedule(id), null),
                new Step("aprobar pedido", () -> s.orders().approve(id), null)));
        return o;
    }

    public static void main(String[] args) {
        Services ok = Services.create();
        System.out.println("Camino feliz: " + checkout("saga-1", ok).log);
        check(ok.orders().status.get("saga-1").equals("APPROVED") && ok.inventory().stock.get("sku-1") == 3, "camino feliz");

        Services bad = Services.create();
        bad.shipping().fail = true;
        System.out.println("Falla el envío: " + checkout("saga-2", bad).log);
        check(bad.orders().status.get("saga-2").equals("CANCELLED"), "pedido cancelado");
        check(bad.inventory().stock.get("sku-1") == 5, "stock devuelto");
        check(bad.payments().refunds.contains("saga-2"), "dinero reembolsado");

        Services retry = Services.create();
        retry.payments().charge("saga-3", 4999);
        retry.payments().charge("saga-3", 4999);                            // reintento tras timeout
        System.out.println("Reintento de cobro: cobros registrados = " + retry.payments().charges.size());
        check(retry.payments().charges.size() == 1, "idempotencia");
        System.out.println("OK");
    }

    static void check(boolean c, String m) { if (!c) throw new AssertionError(m); }
}
