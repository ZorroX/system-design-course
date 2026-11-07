import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Search } from 'lucide-react'
import { GLOSSARY, GLOSS_CATS, termById, type GlossCat } from '@/data/glossary'
import { ARTICLES } from '@/data/articles'
import { useGame } from '@/store/game'
import { Card, ProgressBar, SectionTitle } from '@/components/ui'
import { Rich } from '@/components/Rich'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function Glossary() {
  const read = useGame((s) => s.articlesRead)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<GlossCat | null>(null)
  const articleIds = Object.keys(ARTICLES)

  const terms = useMemo(() => {
    const needle = norm(q.trim())
    return GLOSSARY.filter((t) => (!cat || t.cat === cat) && (!needle || norm([t.term, t.short, ...t.aliases].join(' ')).includes(needle))).sort((a, b) => a.term.localeCompare(b.term, 'es'))
  }, [q, cat])

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <SectionTitle sub="Explicaciones simples de cada término técnico. En las lecciones, los términos subrayados con puntos muestran esta explicación al pasar el cursor o tocarlos.">📖 Glosario y artículos</SectionTitle>

      <div>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="font-bold">Artículos a fondo</div>
            <div className="text-xs text-muted">Conceptos clave explicados con analogías, ejemplos en Java/Python y bibliografía. +10 XP cada uno.</div>
          </div>
          <div className="w-32 shrink-0 text-right">
            <div className="text-xs text-muted mb-1">
              {read.length}/{articleIds.length} leídos
            </div>
            <ProgressBar value={read.length / articleIds.length} color="var(--good)" height={5} />
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 snap-x">
          {articleIds.map((id, i) => {
            const t = termById(id)!
            const done = read.includes(id)
            return (
              <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="snap-start shrink-0 w-64">
                <Link to={`/glossary/${id}`} className={`card p-4 block h-full hover:border-accent/60 transition-colors ${done ? 'border-good/40' : ''}`}>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold">
                    <span className="text-accent">{t.cat}</span>
                    <span className={done ? 'text-good' : 'text-muted'}>{done ? '✓ leído' : `${ARTICLES[id].minutes} min`}</span>
                  </div>
                  <div className="font-bold mt-1">{t.term}</div>
                  <p className="text-xs text-muted mt-1 line-clamp-3">{ARTICLES[id].lead}</p>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un término: mutex, quórum, p99, backpressure…" className="w-full rounded-xl bg-surface border border-border pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={`chip ${!cat ? '!bg-accent !text-[#04131a] !border-accent' : ''}`} onClick={() => setCat(null)}>
            Todos ({GLOSSARY.length})
          </button>
          {GLOSS_CATS.map((c) => (
            <button key={c} className={`chip ${cat === c ? '!bg-accent !text-[#04131a] !border-accent' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {terms.map((t) => (
          <Link key={t.id} to={`/glossary/${t.id}`} className="card p-4 hover:border-accent/60 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-sm">{t.term}</div>
              <span className="flex gap-1 shrink-0">
                {ARTICLES[t.id] && (
                  <span className="chip !text-accent !border-accent/40" title="Tiene artículo completo">
                    <BookOpen size={11} /> artículo
                  </span>
                )}
                <span className="chip">{t.cat}</span>
              </span>
            </div>
            <div className="text-xs text-muted mt-1.5 leading-relaxed line-clamp-3 prose-sd">
              <Rich text={t.short} />
            </div>
          </Link>
        ))}
        {!terms.length && <Card className="p-6 text-sm text-muted sm:col-span-2">No hay términos que coincidan.</Card>}
      </div>
    </div>
  )
}
