import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Motor de búsqueda mínimo: analizador, índice invertido, ranking BM25 y autocompletado.
 * Ejecuta (Java 17+):  java -Dfile.encoding=UTF-8 SearchIndex.java
 * (en JDK 18+ el flag sobra: UTF-8 es el default; en JDK 17 sobre Windows evita que "Ñ" se lea mal)
 *
 * Es lo que Apache Lucene (base de Elasticsearch, OpenSearch y Solr) hace por dentro.
 */
public class SearchIndex {

    static final Set<String> STOP = Set.of("el", "la", "los", "las", "de", "del", "en", "y", "a", "para", "por", "con", "un", "una", "que", "es");
    static final List<String> SUFFIXES = Stream.of("amientos", "imientos", "amiento", "imiento", "aciones", "acion", "mente", "iendo", "ando",
            "ados", "idos", "ado", "ido", "ar", "er", "ir", "as", "os", "es", "a", "o", "s")
            .sorted(Comparator.comparingInt(String::length).reversed()).toList();

    static String fold(String s) { return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", ""); }

    /** Stemmer de juguete para español (en producción: SnowballFilter "Spanish" de Lucene). */
    static String stem(String t) {
        for (String suf : SUFFIXES) if (t.endsWith(suf) && t.length() - suf.length() >= 3) return t.substring(0, t.length() - suf.length());
        return t;
    }

    /** Analyzer: tokenizar -> minúsculas -> sin acentos -> stopwords -> stemming. */
    static List<String> analyze(String text) {
        List<String> out = new ArrayList<>();
        Matcher m = Pattern.compile("[\\p{L}\\p{N}]+").matcher(text);
        while (m.find()) {
            String t = fold(m.group().toLowerCase(Locale.ROOT));
            if (!STOP.contains(t)) out.add(stem(t));
        }
        return out;
    }

    static final class InvertedIndex {
        final double k1 = 1.2, b = 0.75;
        final Map<String, Map<Integer, Integer>> postings = new HashMap<>(); // término -> {doc -> tf}
        final Map<Integer, Integer> docLen = new HashMap<>();
        final Map<Integer, String> docs = new HashMap<>();

        void add(int id, String text) {
            List<String> tokens = analyze(text);
            docs.put(id, text);
            docLen.put(id, tokens.size());
            for (String t : tokens) postings.computeIfAbsent(t, k -> new HashMap<>()).merge(id, 1, Integer::sum);
        }

        List<Map.Entry<Integer, Double>> bm25(String query, int topK) {
            int n = docs.size();
            double avgdl = docLen.values().stream().mapToInt(Integer::intValue).average().orElse(1);
            Map<Integer, Double> scores = new HashMap<>();
            for (String term : analyze(query)) {
                Map<Integer, Integer> p = postings.getOrDefault(term, Map.of());
                if (p.isEmpty()) continue;
                double idf = Math.log(1 + (n - p.size() + 0.5) / (p.size() + 0.5));     // términos raros pesan más
                p.forEach((doc, tf) -> {
                    double norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * docLen.get(doc) / avgdl));
                    scores.merge(doc, idf * norm, Double::sum);
                });
            }
            return scores.entrySet().stream().sorted(Map.Entry.<Integer, Double>comparingByValue().reversed()).limit(topK).toList();
        }
    }

    /** Typeahead por prefijo: TreeMap.subMap encuentra el rango [prefijo, prefijo + '￿'). */
    static final class Autocomplete {
        final TreeMap<String, Map.Entry<String, Integer>> byKey = new TreeMap<>();
        Autocomplete(Map<String, Integer> phrases) {
            phrases.forEach((p, w) -> byKey.put(fold(p.toLowerCase(Locale.ROOT)), Map.entry(p, w)));
        }
        List<String> suggest(String prefix, int k) {
            String p = fold(prefix.toLowerCase(Locale.ROOT));
            return byKey.subMap(p, p + Character.MAX_VALUE).values().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed()).limit(k).map(Map.Entry::getKey).toList();
        }
    }

    public static void main(String[] args) {
        System.out.println("analyze('Corriendo por la MONTAÑA') -> " + analyze("Corriendo por la MONTAÑA"));

        Map<Integer, String> docs = new LinkedHashMap<>();
        docs.put(1, "Zapatillas de trail para correr en la montaña");
        docs.put(2, "Guía para correr tu primera maratón en la ciudad");
        docs.put(3, "Botas de montaña impermeables para senderismo");
        docs.put(4, "Zapatillas urbanas de cuero para la oficina");
        docs.put(5, "Cómo elegir zapatillas de running: amortiguación y drop");
        InvertedIndex idx = new InvertedIndex();
        docs.forEach(idx::add);
        System.out.println("postings[zapatill] = " + idx.postings.get("zapatill"));

        String q = "Corriendo por la montaña";
        var results = idx.bm25(q, 3);
        System.out.println("\nBM25 '" + q + "':");
        results.forEach(e -> System.out.printf("  %5.2f  [%d] %s%n", e.getValue(), e.getKey(), docs.get(e.getKey())));
        if (results.get(0).getKey() != 1) throw new AssertionError("el doc 1 debe ser el primero");

        Autocomplete ac = new Autocomplete(Map.of("zapatillas running", 900, "zapatillas trail", 400, "zapatos de vestir", 300, "zapatillas niño", 150));
        System.out.println("\nautocompletar 'zapa' -> " + ac.suggest("zapa", 3));
        if (!ac.suggest("zapa", 3).get(0).equals("zapatillas running")) throw new AssertionError("ranking por popularidad");
        System.out.println("OK");
    }
}
