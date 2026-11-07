import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TOPICS } from '@/data/topics'
import { Card, SectionTitle } from '@/components/ui'

export default function RealWorld() {
  const items = useMemo(() => TOPICS.flatMap((t) => t.realWorld.map((r) => ({ ...r, topic: t }))), [])
  const companies = useMemo(() => [...new Set(items.map((i) => i.company))].sort(), [items])
  const [filter, setFilter] = useState<string | null>(null)
  const shown = filter ? items.filter((i) => i.company === filter) : items
  return (
    <div className="grid gap-5">
      <SectionTitle sub="Cómo resolvieron estos problemas empresas reales. Citar un caso concreto en una entrevista vale oro.">🏢 Mundo real</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <button className={`chip ${!filter ? '!bg-accent !text-[#04131a] !border-accent' : ''}`} onClick={() => setFilter(null)}>
          Todas ({items.length})
        </button>
        {companies.map((c) => (
          <button key={c} className={`chip ${filter === c ? '!bg-accent !text-[#04131a] !border-accent' : ''}`} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((r, i) => (
          <motion.div key={r.title + r.company} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
            <Card className="p-5 h-full flex flex-col">
              <div className="text-xs font-bold uppercase tracking-wide text-accent">{r.company}</div>
              <div className="font-bold mt-1 mb-2">{r.title}</div>
              <p className="text-sm text-muted leading-relaxed flex-1">{r.text}</p>
              <Link to={`/topic/${r.topic.id}`} className="text-xs text-muted hover:text-accent mt-3">
                {r.topic.icon} {r.topic.title} →
              </Link>
            </Card>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-muted">Más casos en <a className="text-accent hover:underline" href="https://github.com/binhnguyennus/awesome-scalability" target="_blank" rel="noreferrer">awesome-scalability</a> y en los blogs de ingeniería de cada empresa.</p>
    </div>
  )
}
