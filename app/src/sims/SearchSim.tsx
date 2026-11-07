import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { ChallengeBanner } from '@/components/ui'
import { analyze, analyzeStages, bm25, buildIndex, SEARCH_DOCS, type AnalyzerOpts } from '@/lib/search'
import type { SimProps } from './index'

const STAGES: { key: keyof AnalyzerOpts; label: string; desc: string }[] = [
  { key: 'lowercase', label: 'Minúsculas', desc: '"CORRIENDO" → "corriendo"' },
  { key: 'fold', label: 'Quitar acentos', desc: '"montaña" → "montana"' },
  { key: 'stopwords', label: 'Stopwords', desc: 'descarta "por", "la", "de"…' },
  { key: 'stem', label: 'Stemming', desc: '"corriendo", "correr" → "corr"' },
]

const MISSIONS = [
  { id: 'm1', query: 'CORRIENDO por la montana', title: 'El doc #1 debe ganar claramente', hint: 'Necesitas que "CORRIENDO" coincida con "correr" y "montana" con "montaña".' },
  { id: 'm2', query: 'zapatilla', title: 'Encontrar las 4 zapatillas (docs 1, 4, 5 y 8)', hint: 'Los documentos dicen "Zapatillas" (mayúscula y plural).' },
  { id: 'm3', query: 'la montaña', title: 'Solo resultados que hablen de montaña', hint: '"la" aparece en casi todos los documentos y mete ruido.' },
] as const

function checkMission(id: string, results: [number, number][]) {
  if (id === 'm1') return results[0]?.[0] === 1 && (results.length === 1 || results[0][1] >= results[1][1] * 1.5)
  if (id === 'm2') return [1, 4, 5, 8].every((d) => results.some(([r]) => r === d))
  if (id === 'm3') return results.length > 0 && results.every(([d]) => [1, 3, 6].includes(d))
  return false
}

export default function SearchSim({ done, onComplete }: SimProps) {
  const [opts, setOpts] = useState<AnalyzerOpts>({ lowercase: false, fold: false, stopwords: false, stem: false })
  const [query, setQuery] = useState<string>(MISSIONS[0].query)
  const [solved, setSolved] = useState<Record<string, boolean>>({})

  const index = useMemo(() => buildIndex(SEARCH_DOCS, opts), [opts])
  const stages = useMemo(() => analyzeStages(query, opts), [query, opts])
  const qTerms = useMemo(() => analyze(query, opts), [query, opts])
  const results = useMemo(() => bm25(index, qTerms), [index, qTerms])
  const maxScore = results[0]?.[1] ?? 1
  const active = MISSIONS.find((m) => m.query === query)

  useEffect(() => {
    if (active && !solved[active.id] && checkMission(active.id, results)) setSolved((s) => ({ ...s, [active.id]: true }))
  }, [active, results, solved])
  useEffect(() => {
    if (!done && MISSIONS.every((m) => solved[m.id])) onComplete()
  }, [solved, done, onComplete])

  const highlight = (text: string) => {
    const words = text.split(/(\s+|[:,.])/)
    return words.map((w, i) => {
      const t = analyze(w, opts)[0]
      const hit = t && qTerms.includes(t)
      return hit ? (
        <mark key={i} className="bg-warn/30 text-text rounded px-0.5">
          {w}
        </mark>
      ) : (
        <span key={i}>{w}</span>
      )
    })
  }

  const terms = [...index.postings.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Afina el analizador" done={done}>
        Completa las 3 misiones (pulsa cada una para cargar su búsqueda) activando solo las etapas que hagan falta.
      </ChallengeBanner>

      <div className="grid sm:grid-cols-3 gap-2">
        {MISSIONS.map((m, i) => (
          <button key={m.id} onClick={() => setQuery(m.query)} className={`text-left rounded-xl border p-3 text-xs transition-colors ${query === m.query ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-accent/50'}`}>
            <div className="flex justify-between font-bold">
              <span>Misión {i + 1}</span>
              <span>{solved[m.id] ? '✅' : '⬜'}</span>
            </div>
            <div className="font-mono text-accent my-1">"{m.query}"</div>
            <div className="text-muted">{m.title}</div>
          </button>
        ))}
      </div>

      <div className="card p-4 grid gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded-xl bg-surface-2 border border-border px-3 py-2 font-mono focus:outline-none focus:border-accent" aria-label="Consulta" />
        {active && !solved[active.id] && <div className="text-[11px] text-muted">💡 {active.hint}</div>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAGES.map((s) => (
            <button key={s.key} onClick={() => setOpts((o) => ({ ...o, [s.key]: !o[s.key] }))} className={`rounded-xl border px-3 py-2 text-left transition-colors ${opts[s.key] ? 'border-good bg-good/10' : 'border-border bg-surface-2'}`}>
              <div className="text-xs font-bold">
                {opts[s.key] ? '✓ ' : '○ '}
                {s.label}
              </div>
              <div className="text-[10px] text-muted">{s.desc}</div>
            </button>
          ))}
        </div>
        {/* Pipeline del analizador sobre la consulta */}
        <div className="overflow-x-auto">
          <div className="grid gap-1 text-[11px] min-w-[28rem]">
            {(
              [
                ['Tokens', stages.raw],
                ['Minúsculas', stages.lower],
                ['Sin acentos', stages.folded],
                ['Stopwords', stages.stop],
                ['Stemming → términos', stages.stemmed],
              ] as [string, (string | null)[]][]
            ).map(([label, toks]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-muted">{label}</span>
                <div className="flex flex-wrap gap-1">
                  {toks.map((t, i) => (
                    <motion.span layout key={i} className={`font-mono px-1.5 py-0.5 rounded border ${t === null ? 'border-border text-muted line-through opacity-40' : 'border-accent/40 bg-accent/10'}`}>
                      {t ?? stages.folded[i]}
                    </motion.span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Resultados (BM25)</div>
          <div className="grid gap-2">
            <AnimatePresence initial={false}>
              {results.map(([doc, score], rank) => (
                <motion.div layout key={doc} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className="font-bold text-accent">#{rank + 1}</span>
                    <span className="text-muted">doc {doc}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <motion.div className="h-full bg-warn rounded-full" animate={{ width: `${(score / maxScore) * 100}%` }} />
                    </div>
                    <span className="font-mono">{score.toFixed(2)}</span>
                  </div>
                  <div className="text-sm">{highlight(SEARCH_DOCS[doc])}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {!results.length && <div className="text-sm text-muted">Sin resultados: ningún término de la consulta existe en el índice.</div>}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Índice invertido ({terms.length} términos)</div>
          <div className="flex flex-wrap gap-1.5 max-h-80 overflow-y-auto">
            {terms.map(([term, posting]) => {
              const hit = qTerms.includes(term)
              return (
                <motion.span layout key={term} className={`text-[11px] font-mono rounded-md border px-1.5 py-0.5 ${hit ? 'border-warn bg-warn/20 text-text' : 'border-border text-muted'}`} title={`aparece en docs ${[...posting.keys()].join(', ')}`}>
                  {term}
                  <span className="opacity-60"> →{[...posting.keys()].join(',')}</span>
                </motion.span>
              )
            })}
          </div>
          <p className="text-[11px] text-muted mt-3">Cada término apunta a los documentos donde aparece (posting list). Al activar etapas, términos distintos se fusionan y el índice se achica.</p>
        </div>
      </div>
    </div>
  )
}
