import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/**
 * Consistent hashing con nodos virtuales usando TreeMap (árbol rojo-negro).
 * Ejecuta (Java 17+):  java ConsistentHash.java
 */
public class ConsistentHash {

    static final class HashRing {
        private final NavigableMap<Long, String> ring = new TreeMap<>();
        private final int vnodes;

        HashRing(int vnodes) { this.vnodes = vnodes; }

        static long hash(String key) {
            try {
                byte[] d = MessageDigest.getInstance("MD5").digest(key.getBytes(StandardCharsets.UTF_8));
                long h = 0;
                for (int i = 0; i < 8; i++) h = (h << 8) | (d[i] & 0xff);
                return h;
            } catch (Exception e) { throw new IllegalStateException(e); }
        }

        void add(String node) { for (int i = 0; i < vnodes; i++) ring.put(hash(node + "#" + i), node); }
        void remove(String node) { for (int i = 0; i < vnodes; i++) ring.remove(hash(node + "#" + i)); }

        /** Primer vnode en sentido horario (ceilingEntry) o vuelta al inicio. */
        String get(String key) {
            Map.Entry<Long, String> e = ring.ceilingEntry(hash(key));
            return (e != null ? e : ring.firstEntry()).getValue();
        }

        /** N nodos físicos distintos para replicar, como Dynamo/Cassandra. */
        List<String> preferenceList(String key, int n) {
            List<String> out = new ArrayList<>();
            var tailView = ring.tailMap(hash(key), true).values();
            for (String node : concat(tailView, ring.values())) {
                if (!out.contains(node)) out.add(node);
                if (out.size() == n) break;
            }
            return out;
        }

        private static List<String> concat(Collection<String> a, Collection<String> b) {
            List<String> l = new ArrayList<>(a); l.addAll(b); return l;
        }
    }

    public static void main(String[] args) {
        HashRing ring = new HashRing(150);
        for (String n : List.of("cache-a", "cache-b", "cache-c", "cache-d")) ring.add(n);

        Map<String, String> before = new HashMap<>();
        Map<String, Integer> dist = new TreeMap<>();
        for (int i = 0; i < 10_000; i++) {
            String k = "user:" + i, node = ring.get(k);
            before.put(k, node);
            dist.merge(node, 1, Integer::sum);
        }
        System.out.println("Distribución con 4 nodos: " + dist);

        ring.add("cache-e");
        long moved = before.entrySet().stream().filter(e -> !ring.get(e.getKey()).equals(e.getValue())).count();
        long moduloMoved = before.keySet().stream()
                .filter(k -> Math.floorMod(HashRing.hash(k), 4) != Math.floorMod(HashRing.hash(k), 5)).count();
        System.out.printf("Al agregar un 5º nodo se movió %.1f%% (con hash %% N: %.1f%%)%n",
                moved / 100.0, moduloMoved / 100.0);
        if (moved >= moduloMoved / 2) throw new AssertionError("consistent hashing debería mover mucho menos");

        System.out.println("Réplicas para user:42 -> " + ring.preferenceList("user:42", 3));
        System.out.println("OK");
    }
}
