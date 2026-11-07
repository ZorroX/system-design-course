import java.util.*;
import java.util.function.Function;

/**
 * LRU Cache O(1) + patrón cache-aside.
 * Ejecuta (Java 17+):  java LruCache.java
 */
public class LruCache {

    /** Implementación manual: HashMap + lista doblemente enlazada. Es la que piden en entrevistas. */
    static final class Lru<K, V> {
        private final class Node {
            K key; V value; Node prev, next;
            Node(K k, V v) { key = k; value = v; }
        }

        private final int capacity;
        private final Map<K, Node> map = new HashMap<>();
        private final Node head = new Node(null, null); // más reciente tras head
        private final Node tail = new Node(null, null); // menos reciente antes de tail
        long hits, misses;

        Lru(int capacity) {
            this.capacity = capacity;
            head.next = tail;
            tail.prev = head;
        }

        private void unlink(Node n) { n.prev.next = n.next; n.next.prev = n.prev; }
        private void pushFront(Node n) {
            n.prev = head; n.next = head.next;
            head.next.prev = n; head.next = n;
        }

        public synchronized V get(K key) {
            Node n = map.get(key);
            if (n == null) { misses++; return null; }
            unlink(n); pushFront(n);
            hits++;
            return n.value;
        }

        public synchronized void put(K key, V value) {
            Node existing = map.get(key);
            if (existing != null) {
                existing.value = value;
                unlink(existing); pushFront(existing);
                return;
            }
            if (map.size() >= capacity) {
                Node lru = tail.prev;
                unlink(lru);
                map.remove(lru.key);
            }
            Node n = new Node(key, value);
            map.put(key, n);
            pushFront(n);
        }

        public synchronized void invalidate(K key) {
            Node n = map.remove(key);
            if (n != null) unlink(n);
        }

        double hitRate() { return hits + misses == 0 ? 0 : (double) hits / (hits + misses); }
    }

    /** Atajo idiomático en Java: LinkedHashMap con accessOrder=true. */
    static <K, V> Map<K, V> linkedHashMapLru(int capacity) {
        return new LinkedHashMap<>(16, 0.75f, true) {
            @Override protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
                return size() > capacity;
            }
        };
    }

    /** Cache-aside. En Spring sería @Cacheable / @CacheEvict sobre Redis o Caffeine. */
    static final class UserRepository {
        private final Map<Integer, String> db;
        private final Lru<Integer, String> cache;
        int dbReads = 0;

        UserRepository(Map<Integer, String> db, Lru<Integer, String> cache) { this.db = db; this.cache = cache; }

        String find(int id) {
            String cached = cache.get(id);
            if (cached != null) return cached;
            dbReads++;                       // miss: vamos a la DB
            String value = db.get(id);
            if (value != null) cache.put(id, value);
            return value;
        }

        void update(int id, String name) {
            db.put(id, name);
            cache.invalidate(id);            // invalidar > actualizar (evita carreras)
        }
    }

    public static void main(String[] args) {
        Lru<String, Integer> c = new Lru<>(2);
        c.put("a", 1); c.put("b", 2);
        c.get("a");          // 'a' pasa a ser el más reciente
        c.put("c", 3);       // expulsa 'b'
        check(c.get("b") == null && c.get("a") == 1, "debe expulsar 'b'");
        System.out.println("LRU expulsó 'b' correctamente");

        Map<String, Integer> lhm = linkedHashMapLru(2);
        lhm.put("x", 1); lhm.put("y", 2); lhm.get("x"); lhm.put("z", 3);
        check(!lhm.containsKey("y"), "LinkedHashMap LRU");

        Map<Integer, String> db = new HashMap<>();
        for (int i = 0; i < 100; i++) db.put(i, "user-" + i);
        UserRepository repo = new UserRepository(db, new Lru<>(20));
        Random rnd = new Random(1);
        for (int i = 0; i < 300; i++) {
            int id = rnd.nextDouble() < 0.8 ? rnd.nextInt(10) : 10 + rnd.nextInt(90); // 80/20
            repo.find(id);
        }
        System.out.printf("hit rate: %.0f%%  lecturas a DB: %d de 300%n", repo.cache.hitRate() * 100, repo.dbReads);

        repo.update(1, "renamed");
        check(repo.find(1).equals("renamed"), "tras invalidar debe leer el valor nuevo");
        System.out.println("OK");
    }

    static void check(boolean cond, String msg) { if (!cond) throw new AssertionError(msg); }
}
