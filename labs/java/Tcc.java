import java.util.*;

/**
 * TCC (Try-Confirm-Cancel) + Transactional Outbox, sin frameworks.
 * Ejecuta (Java 17+):  java Tcc.java
 *
 * En producción: Seata (modo TCC), o tu propio coordinador con una tabla tcc_tx(tx_id PK, estado)
 * actualizada en la MISMA transacción que el saldo. El outbox lo publica un relay o Debezium (CDC).
 */
public class Tcc {

    enum TxState { TRIED, CONFIRMED, CANCELLED, EMPTY_CANCELLED }

    /** Participante: la billetera. Todos los métodos son idempotentes y tolerantes al desorden. */
    static final class Wallet {
        long available = 500, frozen = 0;
        final Map<String, TxState> log = new HashMap<>();   // tabla tcc_tx
        final List<String> outbox = new ArrayList<>();      // tabla outbox (misma transacción)

        String tryReserve(String tx, long amount) {
            TxState st = log.get(tx);
            if (st == TxState.CANCELLED || st == TxState.EMPTY_CANCELLED) return "rechazado (anti-suspensión: ya se canceló)";
            if (st != null) return "ignorado (Try duplicado)";
            if (available < amount) return "rechazado (fondos insuficientes)";
            available -= amount; frozen += amount; log.put(tx, TxState.TRIED);
            return "congelados $" + amount;
        }

        String confirm(String tx, long amount) {
            if (log.get(tx) != TxState.TRIED) return "ignorado (" + log.get(tx) + ")";
            frozen -= amount; log.put(tx, TxState.CONFIRMED);
            outbox.add("{\"event\":\"WalletDebited\",\"tx\":\"" + tx + "\",\"amount\":" + amount + "}");
            return "descontados $" + amount;
        }

        String cancel(String tx, long amount) {
            TxState st = log.get(tx);
            if (st == null) { log.put(tx, TxState.EMPTY_CANCELLED); return "cancelación vacía registrada"; }
            if (st != TxState.TRIED) return "ignorado (" + st + ")";
            frozen -= amount; available += amount; log.put(tx, TxState.CANCELLED);
            return "liberados $" + amount;
        }
    }

    public static void main(String[] args) {
        Wallet w = new Wallet();
        String[][] msgs = {
                {"try", "T1", "100"}, {"confirm", "T1", "100"}, {"confirm", "T1", "100"},
                {"cancel", "T2", "70"}, {"try", "T2", "70"},          // Cancel llega antes que su Try
                {"try", "T3", "600"},
                {"try", "T4", "150"}, {"cancel", "T4", "150"}, {"cancel", "T4", "150"},
        };
        System.out.println("=== Participante TCC: billetera (saldo inicial $500) ===");
        for (String[] m : msgs) {
            long amt = Long.parseLong(m[2]);
            String r = switch (m[0]) {
                case "try" -> w.tryReserve(m[1], amt);
                case "confirm" -> w.confirm(m[1], amt);
                default -> w.cancel(m[1], amt);
            };
            System.out.printf("  %-8s %-3s $%-4d → %-42s disponible=%d congelado=%d%n", m[0].toUpperCase(), m[1], amt, r, w.available, w.frozen);
        }
        System.out.println("  Invariante: disponible + congelado + confirmado = 500 → " + (w.available + w.frozen + 100 == 500 ? "✔" : "✘"));

        System.out.println("\n=== Outbox: el relay publica al menos una vez; el consumidor deduplica ===");
        Set<String> inbox = new HashSet<>();            // tabla inbox / processed_events con UNIQUE(event_id)
        List<String> delivered = new ArrayList<>(w.outbox);
        delivered.addAll(w.outbox);                     // el relay se cayó tras publicar y reintenta: duplicado
        int applied = 0;
        for (String ev : delivered) if (inbox.add(ev)) applied++;
        System.out.printf("  Entregados %d mensajes, aplicados %d (duplicados descartados: %d)%n", delivered.size(), applied, delivered.size() - applied);
        System.out.println("\nTCC vs Saga: TCC reserva antes de consumir (nunca gastas dinero que luego debas devolver);");
        System.out.println("la saga ejecuta y compensa. TCC exige que cada participante implemente Try/Confirm/Cancel.");
    }
}
