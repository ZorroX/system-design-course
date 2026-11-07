"""
Motor de búsqueda mínimo: analizador, índice invertido, ranking BM25 y autocompletado.
Ejecuta:  python search_index.py

Es lo que Elasticsearch/OpenSearch (Lucene) hacen por dentro, en ~100 líneas.
"""
from __future__ import annotations

import bisect
import math
import re
import unicodedata
from collections import Counter, defaultdict

STOPWORDS = {"el", "la", "los", "las", "de", "del", "en", "y", "a", "para", "por", "con", "un", "una", "que", "es"}
SUFFIXES = sorted(["amientos", "imientos", "amiento", "imiento", "aciones", "acion", "mente", "iendo", "ando",
                   "ados", "idos", "ado", "ido", "ar", "er", "ir", "as", "os", "es", "a", "o", "s"], key=len, reverse=True)


def fold(text: str) -> str:
    """Quita acentos: 'Montaña' -> 'Montana'."""
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def stem(token: str) -> str:
    """Stemmer de juguete para español (en producción: Snowball 'spanish')."""
    for suf in SUFFIXES:
        if token.endswith(suf) and len(token) - len(suf) >= 3:
            return token[: -len(suf)]
    return token


def analyze(text: str, lowercase=True, ascii_fold=True, stopwords=True, stemming=True) -> list[str]:
    """Pipeline de un 'analyzer': tokenizar -> minúsculas -> sin acentos -> stopwords -> stemming."""
    tokens = re.findall(r"\w+", text)
    if lowercase:
        tokens = [t.lower() for t in tokens]
    if ascii_fold:
        tokens = [fold(t) for t in tokens]
    if stopwords:
        tokens = [t for t in tokens if t.lower() not in STOPWORDS]
    if stemming:
        tokens = [stem(t) for t in tokens]
    return tokens


class InvertedIndex:
    def __init__(self, k1: float = 1.2, b: float = 0.75):
        self.k1, self.b = k1, b
        self.postings: dict[str, dict[int, int]] = defaultdict(dict)  # término -> {doc_id: frecuencia}
        self.doc_len: dict[int, int] = {}
        self.docs: dict[int, str] = {}

    def add(self, doc_id: int, text: str) -> None:
        tokens = analyze(text)
        self.docs[doc_id], self.doc_len[doc_id] = text, len(tokens)
        for term, tf in Counter(tokens).items():
            self.postings[term][doc_id] = tf

    def bm25(self, query: str, top_k: int = 3) -> list[tuple[int, float]]:
        n = len(self.docs)
        avgdl = sum(self.doc_len.values()) / n
        scores: dict[int, float] = defaultdict(float)
        for term in analyze(query):
            docs = self.postings.get(term, {})
            if not docs:
                continue
            idf = math.log(1 + (n - len(docs) + 0.5) / (len(docs) + 0.5))  # términos raros pesan más
            for doc_id, tf in docs.items():
                norm = tf * (self.k1 + 1) / (tf + self.k1 * (1 - self.b + self.b * self.doc_len[doc_id] / avgdl))
                scores[doc_id] += idf * norm  # saturación: repetir un término no suma infinito
        return sorted(scores.items(), key=lambda x: -x[1])[:top_k]


class Autocomplete:
    """Typeahead por prefijo con lista ordenada + bisect (un trie o FST en producción)."""

    def __init__(self, phrases: dict[str, int]):
        self.items = sorted((fold(p.lower()), p, w) for p, w in phrases.items())
        self.keys = [k for k, _, _ in self.items]

    def suggest(self, prefix: str, k: int = 3) -> list[str]:
        p = fold(prefix.lower())
        i = bisect.bisect_left(self.keys, p)
        matches = []
        while i < len(self.items) and self.keys[i].startswith(p):
            matches.append(self.items[i])
            i += 1
        return [orig for _, orig, _ in sorted(matches, key=lambda m: -m[2])[:k]]


DOCS = {
    1: "Zapatillas de trail para correr en la montaña",
    2: "Guía para correr tu primera maratón en la ciudad",
    3: "Botas de montaña impermeables para senderismo",
    4: "Zapatillas urbanas de cuero para la oficina",
    5: "Cómo elegir zapatillas de running: amortiguación y drop",
}


def demo() -> None:
    print("analyze('Corriendo por la MONTAÑA') ->", analyze("Corriendo por la MONTAÑA"))
    print("sin analizador                     ->", analyze("Corriendo por la MONTAÑA", False, False, False, False))

    idx = InvertedIndex()
    for d, text in DOCS.items():
        idx.add(d, text)
    print("postings['zapatill'] =", dict(idx.postings["zapatill"]))

    q = "Corriendo por la montaña"
    results = idx.bm25(q)
    print(f"\nBM25 '{q}':")
    for doc_id, score in results:
        print(f"  {score:5.2f}  [{doc_id}] {DOCS[doc_id]}")
    assert results[0][0] == 1, "el doc de trail en montaña debe ser el primero"

    ac = Autocomplete({"zapatillas running": 900, "zapatillas trail": 400, "zapatos de vestir": 300, "zapatillas niño": 150})
    print("\nautocompletar 'zapa' ->", ac.suggest("zapa"))
    assert ac.suggest("zapa")[0] == "zapatillas running"
    print("OK")


if __name__ == "__main__":
    demo()
