import java.util.*;

/**
 * Replicación con quórum N/R/W (Dynamo, Cassandra, Riak).
 * Ejecuta (Java 17+):  java Quorum.java
 *
 * En Cassandra: CONSISTENCY QUORUM en lectura y escritura con RF=3 => R=2, W=2 => R+W>N.
 */
public class Quorum {

    record Versioned(long version, String value) {}

    static final class Replica {
        final String name;
        boolean up = true;
        final Map<String, Versioned> data = new HashMap<>();
        Replica(String name) { this.name = name; }
    }

    static final class QuorumStore {
        final List<Replica> replicas = new ArrayList<>();
        final int n, r, w;
        final Random rnd;

        QuorumStore(int n, int r, int w, long seed) {
            this.n = n; this.r = r; this.w = w; this.rnd = new Random(seed);
            for (int i = 0; i < n; i++) replicas.add(new Replica("r" + i));
        }

        private List<Replica> alive() {
            List<Replica> a = new ArrayList<>(replicas.stream().filter(x -> x.up).toList());
            Collections.shuffle(a, rnd);
            return a;
        }

        boolean write(String key, String value) {
            long version = 1 + replicas.stream()
                    .mapToLong(x -> x.data.getOrDefault(key, new Versioned(0, null)).version()).max().orElse(0);
            List<Replica> a = alive();
            if (a.size() < w) return false;
            for (Replica rep : a.subList(0, w)) rep.data.put(key, new Versioned(version, value));
            return true;
        }

        String read(String key) {
            List<Replica> a = alive();
            if (a.size() < r) throw new IllegalStateException("sin quórum de lectura " + a.size() + "/" + r);
            List<Replica> sample = a.subList(0, r);
            Versioned newest = sample.stream()
                    .map(x -> x.data.getOrDefault(key, new Versioned(0, null)))
                    .max(Comparator.comparingLong(Versioned::version)).orElseThrow();
            for (Replica rep : sample) // read repair
                if (rep.data.getOrDefault(key, new Versioned(0, null)).version() < newest.version())
                    rep.data.put(key, newest);
            return newest.value();
        }
    }

    public static void main(String[] args) {
        int[][] configs = {{3, 1, 1}, {3, 2, 2}, {3, 1, 3}, {5, 3, 3}};
        for (int[] c : configs) {
            QuorumStore s = new QuorumStore(c[0], c[1], c[2], 42);
            int stale = 0;
            for (int i = 0; i < 2000; i++) {
                s.write("k", "v" + i);
                if (!("v" + i).equals(s.read("k"))) stale++;
            }
            boolean strong = c[1] + c[2] > c[0];
            System.out.printf("N=%d R=%d W=%d  %s  lecturas viejas: %d%n", c[0], c[1], c[2],
                    strong ? "R+W>N OK" : "R+W<=N X", stale);
            if (strong && stale > 0) throw new AssertionError("no debería haber lecturas viejas");
        }

        QuorumStore store = new QuorumStore(3, 2, 2, 1);
        store.write("cart", "[libro]");
        store.replicas.get(0).up = false;
        store.write("cart", "[libro, taza]");
        System.out.println("Con 1 réplica caída: " + store.read("cart"));
        store.replicas.get(1).up = false;
        try { store.read("cart"); }
        catch (IllegalStateException e) { System.out.println("Con 2 caídas: " + e.getMessage() + " -> CP"); }
        System.out.println("OK");
    }
}
