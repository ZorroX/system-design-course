import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, X } from 'lucide-react'
import { CORE_TOPICS as TOPICS, DOMAINS, topicById } from '@/data/topics'
import { topicCompleted, topicScore, useGame } from '@/store/game'
import { ProgressBar, SectionTitle } from '@/components/ui'
import type { Topic } from '@/data/types'

// margen interno para que los nodos de los bordes no se corten
const PX = (x: number) => 7 + x * 0.86
const PY = (y: number) => 7 + y * 0.86

export default function SkillMap() {
  const topics = useGame((s) => s.topics)
  const nav = useNavigate()
  const [sel, setSel] = useState<Topic | null>(null)

  const status = (t: Topic) => (topicCompleted(topics[t.id]) ? 'done' : t.prerequisites.every((p) => topicCompleted(topics[p])) ? 'ready' : 'locked')

  return (
    <div>
      <SectionTitle sub="Cada nodo es un tema. Completa su quiz (≥ 70%) para desbloquear los siguientes. Puedes explorar cualquiera cuando quieras.">Mapa de habilidades</SectionTitle>

      <Link to="/path" className="mb-4 flex items-center gap-3 rounded-xl border border-good/40 bg-good/5 px-4 py-3 text-sm hover:border-good transition-colors">
        <span className="text-2xl">🎯</span>
        <span className="flex-1"><b>Ruta: entrevista Java Backend · Pagos</b> — 8 temas extra (Spring/JVM, concurrencia, diagnóstico, SQL, idempotencia, sagas/TCC, despliegues y liderazgo) organizados en 3 etapas.</span>
        <span className="text-good font-semibold">Abrir →</span>
      </Link>
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {Object.values(DOMAINS).filter((d) => TOPICS.some((t) => t.domain === d.id)).map((d) => (
          <span key={d.id} className="chip">
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name}
          </span>
        ))}
      </div>

      <div className="relative card bg-grid overflow-hidden aspect-[1/2] sm:aspect-auto sm:h-[780px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {TOPICS.flatMap((t) =>
            t.prerequisites.map((pid) => {
              const p = topicById(pid)!
              const done = topicCompleted(topics[pid])
              const [x1, y1, x2, y2] = [PX(p.pos.x), PY(p.pos.y), PX(t.pos.x), PY(t.pos.y)]
              const midY = (y1 + y2) / 2
              const d = `M ${x1} ${y1 + 3} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2 - 3}`
              return (
                <g key={`${pid}-${t.id}`}>
                  <path d={d} fill="none" stroke="var(--border)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
                  {done && <path d={d} fill="none" stroke="var(--good)" vectorEffect="non-scaling-stroke" className="flow-dash" style={{ strokeWidth: 2.5 }} />}
                </g>
              )
            }),
          )}
        </svg>
        {TOPICS.map((t, i) => {
          const st = status(t)
          const score = topicScore(topics[t.id])
          const color = DOMAINS[t.domain].color
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 20 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSel(t)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-20 sm:w-32"
              style={{ left: `${PX(t.pos.x)}%`, top: `${PY(t.pos.y)}%` }}
            >
              <div className="relative">
                {st === 'ready' && <motion.span className="absolute inset-0 rounded-full" style={{ background: color }} animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} />}
                <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="var(--surface-2)" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="16" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={`${(score / 100) * 100.5} 100.5`} strokeLinecap="round" />
                </svg>
                <div
                  className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl sm:text-2xl border-2 ${st === 'locked' ? 'grayscale opacity-60' : ''}`}
                  style={{ background: 'var(--surface)', borderColor: st === 'done' ? 'var(--good)' : st === 'ready' ? color : 'var(--border)', boxShadow: st === 'done' ? '0 0 18px color-mix(in srgb, var(--good) 50%, transparent)' : undefined }}
                >
                  {t.icon}
                  {st === 'locked' && <Lock size={12} className="absolute -bottom-0.5 -right-0.5 bg-surface-2 rounded-full p-0.5 w-4 h-4 text-muted" />}
                  {st === 'done' && <span className="absolute -bottom-1 -right-1 text-xs bg-good text-[#04131a] rounded-full w-4 h-4 flex items-center justify-center font-bold">✓</span>}
                </div>
              </div>
              <div className="mt-1.5 text-[9px] sm:text-xs font-semibold leading-tight text-center px-1 rounded bg-bg/70">{t.title}</div>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {sel && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed inset-x-3 bottom-20 lg:bottom-6 lg:left-auto lg:right-8 lg:w-96 z-40 card p-5 shadow-2xl"
          >
            <button className="absolute top-3 right-3 text-muted hover:text-text" onClick={() => setSel(null)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{sel.icon}</span>
              <div>
                <div className="font-bold">{sel.title}</div>
                <div className="text-xs text-muted">{sel.subtitle}</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px] text-center my-3">
              {[
                ['📖', 'Leído', topics[sel.id]?.read],
                ['🕹️', 'Simulador', sel.simulator ? topics[sel.id]?.simDone : null],
                ['💻', 'Código', sel.code ? topics[sel.id]?.codeViewed : null],
                ['🎯', `Quiz ${topics[sel.id]?.quizBest ?? 0}%`, topicCompleted(topics[sel.id])],
              ].map(([icon, label, ok]) => (
                <div key={label as string} className={`rounded-lg border py-1.5 ${ok ? 'border-good/50 bg-good/10' : ok === null ? 'border-border opacity-40' : 'border-border'}`}>
                  <div className="text-base">{icon as string}</div>
                  {label as string}
                </div>
              ))}
            </div>
            <ProgressBar value={topicScore(topics[sel.id]) / 100} color={DOMAINS[sel.domain].color} />
            {status(sel) === 'locked' && (
              <div className="text-xs text-warn mt-3">
                Recomendado antes: {sel.prerequisites.map((p) => topicById(p)!.title).join(', ')}
              </div>
            )}
            <button className="btn btn-primary w-full mt-4" onClick={() => nav(`/topic/${sel.id}`)}>
              {topics[sel.id]?.read ? 'Continuar' : 'Empezar'} · ~{sel.minutes} min
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
