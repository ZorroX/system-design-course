/** Mini motor de búsqueda para el simulador (mismo algoritmo que labs/python/search_index.py). */
export interface AnalyzerOpts {
  lowercase: boolean
  fold: boolean
  stopwords: boolean
  stem: boolean
}

export const STOPWORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'para', 'por', 'con', 'un', 'una', 'que', 'es', 'tu', 'mi'])
const SUFFIXES = ['amientos', 'imientos', 'amiento', 'imiento', 'aciones', 'acion', 'mente', 'iendo', 'ando', 'ados', 'idos', 'ado', 'ido', 'ar', 'er', 'ir', 'as', 'os', 'es', 'a', 'o', 's'].sort((a, b) => b.length - a.length)

export const foldText = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')

export function stemToken(t: string) {
  for (const suf of SUFFIXES) if (t.endsWith(suf) && t.length - suf.length >= 3) return t.slice(0, -suf.length)
  return t
}

export function tokenize(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+/gu) ?? []
}

/** Devuelve el token resultante de cada etapa (para visualizar el pipeline). null = descartado. */
export function analyzeStages(text: string, o: AnalyzerOpts) {
  const raw = tokenize(text)
  const lower = raw.map((t) => (o.lowercase ? t.toLowerCase() : t))
  const folded = lower.map((t) => (o.fold ? foldText(t) : t))
  const stop = folded.map((t) => (o.stopwords && STOPWORDS.has(t.toLowerCase()) ? null : t))
  const stemmed = stop.map((t) => (t === null ? null : o.stem ? stemToken(t) : t))
  return { raw, lower, folded, stop, stemmed }
}

export function analyze(text: string, o: AnalyzerOpts): string[] {
  return analyzeStages(text, o).stemmed.filter((t): t is string => t !== null)
}

export interface Index {
  postings: Map<string, Map<number, number>>
  docLen: Map<number, number>
}

export function buildIndex(docs: Record<number, string>, o: AnalyzerOpts): Index {
  const postings = new Map<string, Map<number, number>>()
  const docLen = new Map<number, number>()
  for (const [idStr, text] of Object.entries(docs)) {
    const id = Number(idStr)
    const toks = analyze(text, o)
    docLen.set(id, toks.length)
    for (const t of toks) {
      if (!postings.has(t)) postings.set(t, new Map())
      const p = postings.get(t)!
      p.set(id, (p.get(id) ?? 0) + 1)
    }
  }
  return { postings, docLen }
}

export function bm25(index: Index, queryTerms: string[], k1 = 1.2, b = 0.75) {
  const n = index.docLen.size
  const avgdl = [...index.docLen.values()].reduce((a, c) => a + c, 0) / n
  const scores = new Map<number, number>()
  for (const term of new Set(queryTerms)) {
    const p = index.postings.get(term)
    if (!p) continue
    const idf = Math.log(1 + (n - p.size + 0.5) / (p.size + 0.5))
    for (const [doc, tf] of p) {
      const norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * index.docLen.get(doc)!) / avgdl))
      scores.set(doc, (scores.get(doc) ?? 0) + idf * norm)
    }
  }
  return [...scores.entries()].sort((a, b2) => b2[1] - a[1] || a[0] - b2[0])
}

export const SEARCH_DOCS: Record<number, string> = {
  1: 'Zapatillas de trail para correr en la montaña',
  2: 'Guía para correr tu primera maratón en la ciudad',
  3: 'Botas de montaña impermeables para senderismo',
  4: 'Zapatillas urbanas de cuero para la oficina',
  5: 'Cómo elegir zapatillas de running: amortiguación y drop',
  6: 'Mochila ligera para la montaña y el trail',
  7: 'Calcetines técnicos para correr largas distancias',
  8: 'La historia de la zapatilla deportiva',
}
