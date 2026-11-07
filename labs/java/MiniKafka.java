import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.CRC32;

/**
 * Mini-Kafka: log particionado, clave -> partición, consumer groups con offsets.
 * Ejecuta (Java 17+):  java MiniKafka.java
 *
 * Con el cliente real: KafkaProducer.send(new ProducerRecord<>("orders", userId, payload))
 * y en Spring: @KafkaListener(topics = "orders", groupId = "billing").
 */
public class MiniKafka {

    record Record(int offset, String key, String value) {}

    static final class Topic {
        final List<List<Record>> partitions = new ArrayList<>();
        Topic(int n) { for (int i = 0; i < n; i++) partitions.add(new ArrayList<>()); }

        int partitionFor(String key) {
            CRC32 crc = new CRC32();
            crc.update(key.getBytes(StandardCharsets.UTF_8));
            return (int) (crc.getValue() % partitions.size());
        }

        int produce(String key, String value) {
            int p = partitionFor(key);
            List<Record> log = partitions.get(p);
            log.add(new Record(log.size(), key, value)); // append-only
            return p;
        }
    }

    static final class ConsumerGroup {
        final Topic topic;
        final Map<Integer, Integer> committed = new HashMap<>();
        Map<String, List<Integer>> assignment = new LinkedHashMap<>();

        ConsumerGroup(Topic topic, List<String> members) { this.topic = topic; rebalance(members); }

        void rebalance(List<String> members) {
            assignment = new LinkedHashMap<>();
            members.forEach(m -> assignment.put(m, new ArrayList<>()));
            for (int p = 0; p < topic.partitions.size(); p++)
                assignment.get(members.get(p % members.size())).add(p);
        }

        List<Map.Entry<Integer, Record>> poll(String member) {
            List<Map.Entry<Integer, Record>> out = new ArrayList<>();
            for (int p : assignment.getOrDefault(member, List.of())) {
                List<Record> log = topic.partitions.get(p);
                for (int o = committed.getOrDefault(p, 0); o < log.size(); o++) out.add(Map.entry(p, log.get(o)));
            }
            return out;
        }

        void commit(int partition, int offset) { committed.put(partition, offset + 1); }

        int totalLag() {
            int lag = 0;
            for (int p = 0; p < topic.partitions.size(); p++)
                lag += topic.partitions.get(p).size() - committed.getOrDefault(p, 0);
            return lag;
        }
    }

    public static void main(String[] args) {
        Topic orders = new Topic(3);
        for (int i = 0; i < 12; i++) orders.produce("user-" + (i % 4), "order-" + i);

        int p = orders.partitionFor("user-1");
        List<String> seq = orders.partitions.get(p).stream()
                .filter(r -> r.key().equals("user-1")).map(Record::value).toList();
        System.out.println("Eventos de user-1 (en orden): " + seq);
        check(seq.equals(List.of("order-1", "order-5", "order-9")), "orden por clave");

        ConsumerGroup billing = new ConsumerGroup(orders, List.of("c1", "c2"));
        ConsumerGroup analytics = new ConsumerGroup(orders, List.of("a1"));
        System.out.println("Asignación billing: " + billing.assignment);
        for (String m : List.of("c1", "c2"))
            for (var e : billing.poll(m)) billing.commit(e.getKey(), e.getValue().offset());
        System.out.println("Lag billing: " + billing.totalLag() + " | Lag analytics: " + analytics.totalLag());
        check(billing.totalLag() == 0 && analytics.totalLag() == 12, "offsets independientes por grupo");

        billing.rebalance(List.of("c1", "c2", "c3", "c4"));
        System.out.println("Con 4 consumidores y 3 particiones: " + billing.assignment + " -> c4 queda ocioso");
        System.out.println("OK");
    }

    static void check(boolean c, String m) { if (!c) throw new AssertionError(m); }
}
