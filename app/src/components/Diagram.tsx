import { motion } from 'motion/react'
import type { CaseStudy } from '@/data/cases'
import { CATALOG, KIND_COLOR } from '@/lab/catalog'

export function Diagram({ diagram }: { diagram: CaseStudy['diagram'] }) {
  const byId = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]))
  // margen interno para que los nodos de los bordes no se corten
  const X = (x: number) => 6 + x * 0.88
  const Y = (y: number) => 8 + y * 0.84
  return (
    <div className="relative card bg-grid overflow-hidden aspect-[4/5] sm:aspect-[16/9]">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {diagram.edges.map(([a, b], i) => {
          const p = byId[a]
          const q = byId[b]
          return (
            <motion.line
              key={i}
              x1={X(p.x)}
              y1={Y(p.y)}
              x2={X(q.x)}
              y2={Y(q.y)}
              stroke="var(--accent)"
              strokeOpacity={0.6}
              vectorEffect="non-scaling-stroke"
              className="flow-dash"
              style={{ strokeWidth: 2 }}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            />
          )
        })}
      </svg>
      {diagram.edges.map(([a, b, label], i) => {
        if (!label) return null
        const p = byId[a]
        const q = byId[b]
        return (
          <div key={`l${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-mono text-muted bg-bg/80 px-1 rounded whitespace-nowrap" style={{ left: `${(X(p.x) + X(q.x)) / 2}%`, top: `${(Y(p.y) + Y(q.y)) / 2}%` }}>
            {label}
          </div>
        )
      })}
      {diagram.nodes.map((n, i) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 bg-surface px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-center shadow-lg max-w-[7rem] sm:max-w-[9rem]"
          style={{ left: `${X(n.x)}%`, top: `${Y(n.y)}%`, borderColor: KIND_COLOR[n.kind] }}
        >
          <div className="text-base sm:text-lg leading-none">{CATALOG[n.kind].icon}</div>
          <div className="text-[9px] sm:text-[11px] font-semibold leading-tight mt-0.5">{n.label}</div>
        </motion.div>
      ))}
    </div>
  )
}
