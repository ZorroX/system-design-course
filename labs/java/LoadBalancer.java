import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Estrategias de balanceo de carga.
 * Ejecuta (Java 17+):  java LoadBalancer.java
 */
public class LoadBalancer {

    static final class Server {
        final String name;
        final int weight;
        final AtomicInteger active = new AtomicInteger(); // conexiones abiertas
        volatile boolean healthy = true;
        int currentWeight = 0; // estado del smooth WRR

        Server(String name, int weight) { this.name = name; this.weight = weight; }
        @Override public String toString() { return name; }
    }

    interface Strategy { Server pick(); }

    /** Round robin thread-safe que salta servidores no sanos. */
    static final class RoundRobin implements Strategy {
        private final List<Server> servers;
        private final AtomicInteger next = new AtomicInteger();
        RoundRobin(List<Server> servers) { this.servers = servers; }

        public Server pick() {
            for (int i = 0; i < servers.size(); i++) {
                Server s = servers.get(Math.floorMod(next.getAndIncrement(), servers.size()));
                if (s.healthy) return s;
            }
            throw new IllegalStateException("no hay servidores sanos");
        }
    }

    /** Smooth Weighted Round Robin (el de NGINX): respeta pesos sin ráfagas. */
    static final class SmoothWeightedRoundRobin implements Strategy {
        private final List<Server> servers;
        SmoothWeightedRoundRobin(List<Server> servers) { this.servers = servers; }

        public synchronized Server pick() {
            int total = 0;
            Server best = null;
            for (Server s : servers) {
                if (!s.healthy) continue;
                s.currentWeight += s.weight;
                total += s.weight;
                if (best == null || s.currentWeight > best.currentWeight) best = s;
            }
            if (best == null) throw new IllegalStateException("no hay servidores sanos");
            best.currentWeight -= total;
            return best;
        }
    }

    static final class LeastConnections implements Strategy {
        private final List<Server> servers;
        LeastConnections(List<Server> servers) { this.servers = servers; }

        public Server pick() {
            return servers.stream().filter(s -> s.healthy)
                    .min(Comparator.comparingInt(s -> s.active.get()))
                    .orElseThrow();
        }
    }

    /** Power of two choices: 2 al azar, gana el menos cargado (Envoy, HAProxy). */
    static final class PowerOfTwoChoices implements Strategy {
        private final List<Server> servers;
        PowerOfTwoChoices(List<Server> servers) { this.servers = servers; }

        public Server pick() {
            List<Server> alive = servers.stream().filter(s -> s.healthy).toList();
            var rnd = ThreadLocalRandom.current();
            Server a = alive.get(rnd.nextInt(alive.size()));
            Server b = alive.get(rnd.nextInt(alive.size()));
            return a.active.get() <= b.active.get() ? a : b;
        }
    }

    public static void main(String[] args) {
        List<Server> servers = List.of(new Server("A", 5), new Server("B", 1), new Server("C", 1));

        Strategy wrr = new SmoothWeightedRoundRobin(servers);
        StringBuilder seq = new StringBuilder();
        for (int i = 0; i < 7; i++) seq.append(wrr.pick());
        System.out.println("Smooth WRR (5:1:1): " + seq);
        check(seq.chars().filter(c -> c == 'A').count() == 5, "A debe salir 5 de 7 veces");

        servers.get(1).healthy = false; // B cae: el health check lo saca de rotación
        Strategy rr = new RoundRobin(servers);
        seq.setLength(0);
        for (int i = 0; i < 6; i++) seq.append(rr.pick());
        System.out.println("Round robin con B caído: " + seq);
        check(seq.indexOf("B") < 0, "B no debe recibir tráfico");
        servers.get(1).healthy = true;

        Strategy lc = new LeastConnections(servers);
        servers.get(0).active.set(10);
        servers.get(2).active.set(3);
        System.out.println("Least connections elige: " + lc.pick() + " (A=10, B=0, C=3)");
        check(lc.pick().name.equals("B"), "debe elegir B");

        System.out.println("OK");
    }

    static void check(boolean cond, String msg) {
        if (!cond) throw new AssertionError(msg);
    }
}
