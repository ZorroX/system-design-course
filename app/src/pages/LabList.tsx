import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { CHALLENGES } from '@/data/challenges'
import { useGame } from '@/store/game'
import { SectionTitle } from '@/components/ui'
import { fmt } from '@/lib/format'

export default function LabList() {
  const labs = useGame((s) => s.labs)
  return (
    <div>
      <SectionTitle sub="Arrastra componentes, conéctalos y somete tu arquitectura a tráfico real. El motor calcula utilización, latencia p99, disponibilidad y costo en vivo.">🧪 Design Lab</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {CHALLENGES.map((c, i) => {
          const r = labs[c.id]
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/lab/${c.id}`} className="card p-5 block h-full hover:border-accent/60 transition-colors group">
                <div className="flex items-start justify-between">
                  <span className="text-4xl group-hover:scale-110 transition-transform">{c.emoji}</span>
                  <span className="text-lg tracking-wider">
                    {[1, 2, 3].map((s) => (
                      <span key={s} className={s <= (r?.stars ?? 0) ? 'text-warn' : 'text-border'}>★</span>
                    ))}
                  </span>
                </div>
                <div className="font-bold mt-3">{c.title}</div>
                <div className="text-xs text-muted mt-1 mb-3 line-clamp-2">{c.story}</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="chip">{fmt(c.rps)} RPS</span>
                  <span className="chip">p99 &lt; {c.p99} ms</span>
                  <span className="chip">{(c.availability * 100).toFixed(c.availability >= 0.9999 ? 2 : c.availability >= 0.999 ? 2 : 0)}%</span>
                  <span className="chip">{'🔥'.repeat(c.difficulty)}</span>
                </div>
                {r && <div className="text-xs text-muted mt-3">Mejor puntuación: {r.score}/100 · ${fmt(r.cost)}/mes</div>}
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
