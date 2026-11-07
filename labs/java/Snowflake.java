import java.util.*;
import java.util.function.LongSupplier;

/**
 * IDs únicos distribuidos (Snowflake) + router de shards lógicos -> físicos.
 * Ejecuta (Java 17+):  java Snowflake.java
 *
 * 64 bits: 1 signo | 41 timestamp ms | 10 máquina | 12 secuencia
 */
public class Snowflake {

    static final long EPOCH_MS = 1_288_834_974_657L; // epoch de Twitter

    static final class IdGenerator {
        private final long machineId;
        private final LongSupplier clock;
        private long lastMs = -1, seq = 0;

        IdGenerator(long machineId, LongSupplier clock) {
            if (machineId < 0 || machineId >= 1024) throw new IllegalArgumentException("10 bits");
            this.machineId = machineId;
            this.clock = clock;
        }

        synchronized long nextId() {
            long now = clock.getAsLong();
            if (now < lastMs) throw new IllegalStateException("el reloj retrocedió");
            if (now == lastMs) {
                seq = (seq + 1) & 0xFFF;
                if (seq == 0) while ((now = clock.getAsLong()) <= lastMs) Thread.onSpinWait();
            } else {
                seq = 0;
            }
            lastMs = now;
            return ((now - EPOCH_MS) << 22) | (machineId << 12) | seq;
        }

        static String parse(long id) {
            return "ts=" + ((id >> 22) + EPOCH_MS) + " machine=" + ((id >> 12) & 0x3FF) + " seq=" + (id & 0xFFF);
        }
    }

    /** Muchos shards lógicos sobre pocos servidores: rebalancear = mover shards completos. */
    static final class ShardRouter {
        private final int logical;
        private final Map<Integer, String> map = new HashMap<>();

        ShardRouter(int logical, List<String> physical) {
            this.logical = logical;
            for (int s = 0; s < logical; s++) map.put(s, physical.get(s % physical.size()));
        }
        int shardFor(long userId) { return (int) Math.floorMod(userId, (long) logical); }
        String serverFor(long userId) { return map.get(shardFor(userId)); }
        void move(int shard, String server) { map.put(shard, server); }
    }

    public static void main(String[] args) {
        IdGenerator gen = new IdGenerator(7, System::currentTimeMillis);
        long[] ids = new long[10_000];
        for (int i = 0; i < ids.length; i++) ids[i] = gen.nextId();
        Set<Long> unique = new HashSet<>();
        for (int i = 0; i < ids.length; i++) {
            unique.add(ids[i]);
            if (i > 0 && ids[i] <= ids[i - 1]) throw new AssertionError("deben ser monótonos");
        }
        if (unique.size() != ids.length) throw new AssertionError("duplicados");
        System.out.println("ID: " + ids[0] + " -> " + IdGenerator.parse(ids[0]));

        ShardRouter router = new ShardRouter(4096, List.of("pg-1", "pg-2"));
        System.out.println("user 12345 -> shard " + router.shardFor(12345) + " en " + router.serverFor(12345));
        for (int s = 0; s < 4096; s += 3) router.move(s, "pg-3");
        System.out.println("tras rebalanceo -> " + router.serverFor(12345));
        System.out.println("OK");
    }
}
