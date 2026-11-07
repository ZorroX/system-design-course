import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { ChallengeBanner, Segmented } from '@/components/ui'
import { useColors } from '@/lib/hooks'
import type { SimProps } from './index'

type Mode = 'CP' | 'AP'
interface Replica { id: string; dc: 'A' | 'B'; value: string; ts: number }
interface LogLine { id: number; text: string; tone: 'ok' | 'bad' | 'warn' | 'info' }

const FRUITS = ['🍎', '🍌', '🍇', '🍒', '🥝', '🍑', '🍍', '🥭']
let logId = 1

export default function PartitionSim({ done, onComplete }: SimProps) {
  const colors = useColors()
  const [mode, setMode] = useState<Mode>('CP')
  const [partitioned, setPartitioned] = useState(false)
  const [replicas, setReplicas] = useState<Replica[]>([
    { id: 'N1', dc: 'A', value: '🍎', ts: 1 },
    { id: 'N2', dc: 'A', value: '🍎', ts: 1 },
    { id: 'N3', dc: 'B', value: '🍎', ts: 1 },
  ])
  const [log, setLog] = useState<LogLine[]>([])
  const [clock, setClock] = useState(2)
  const [packets, setPackets] = useState<{ id: number; from: string; to: string }[]>([])
  const [goals, setGoals] = useState({ cpReject: false, apConflict: false })

  const push = (text: string, tone: LogLine['tone']) => setLog((l) => [{ id: logId++, text, tone }, ...l].slice(0, 8))

  useEffect(() => {
    if (!done && goals.cpReject && goals.apConflict) onComplete()
  }, [goals, done, onComplete])

  const reachable = (from: 'A' | 'B') => replicas.filter((r) => !partitioned || r.dc === from)

  const animate = (from: string, targets: string[]) => {
    const ps = targets.filter((t) => t !== from).map((to) => ({ id: logId++, from, to }))
    setPackets((p) => [...p, ...ps])
    setTimeout(() => setPackets((p) => p.filter((x) => !ps.includes(x))), 700)
  }

  const write = (side: 'A' | 'B') => {
    const value = FRUITS[Math.floor(Math.random() * FRUITS.length)]
    const ts = clock
    setClock((c) => c + 1)
    const reach = reachable(side)
    const entry = side === 'A' ? 'N1' : 'N3'
    if (mode === 'CP' && reach.length < 2) {
      push(`Cliente ${side} escribe ${value}: ❌ RECHAZADO — solo ${reach.length}/3 réplicas alcanzables, sin quórum (2)`, 'bad')
      setGoals((g) => ({ ...g, cpReject: true }))
      return
    }
    setReplicas((rs) => rs.map((r) => (reach.some((x) => x.id === r.id) ? { ...r, value, ts } : r)))
    animate(entry, reach.map((r) => r.id))
    push(`Cliente ${side} escribe ${value} (t=${ts}) en ${reach.map((r) => r.id).join(', ')} ✅`, mode === 'AP' && partitioned ? 'warn' : 'ok')
  }

  const read = (side: 'A' | 'B') => {
    const reach = reachable(side)
    if (mode === 'CP' && reach.length < 2) {
      push(`Cliente ${side} lee: ❌ ERROR — sin quórum, preferimos no responder a responder viejo`, 'bad')
      setGoals((g) => ({ ...g, cpReject: true }))
      return
    }
    const newest = reach.reduce((a, b) => (b.ts > a.ts ? b : a))
    const global = replicas.reduce((a, b) => (b.ts > a.ts ? b : a))
    const stale = newest.ts < global.ts
    push(`Cliente ${side} lee ${newest.value} de ${reach.map((r) => r.id).join('/')}${stale ? ' ⚠️ (hay un valor más nuevo al otro lado)' : ''}`, stale ? 'warn' : 'info')
  }

  const toggle = () => {
    if (!partitioned) {
      setPartitioned(true)
      push('✂️ Partición de red entre DC-A y DC-B', 'bad')
      return
    }
    setPartitioned(false)
    const winner = replicas.reduce((a, b) => (b.ts > a.ts ? b : a))
    const losers = replicas.filter((r) => r.value !== winner.value)
    if (losers.length) {
      const lostValues = [...new Set(losers.map((l) => l.value))]
      push(`🔗 Red restaurada. Conflicto: ${[...new Set(replicas.map((r) => r.value))].join(' vs ')}. Last-write-wins elige ${winner.value} (t=${winner.ts}); se pierde ${lostValues.join(', ')}`, 'warn')
      if (mode === 'AP') setGoals((g) => ({ ...g, apConflict: true }))
    } else push('🔗 Red restaurada. Réplicas sincronizadas sin conflicto.', 'ok')
    setReplicas((rs) => rs.map((r) => ({ ...r, value: winner.value, ts: winner.ts })))
    animate(winner.id, replicas.map((r) => r.id))
  }

  const P: Record<string, { x: number; y: number }> = { N1: { x: 90, y: 70 }, N2: { x: 90, y: 170 }, N3: { x: 330, y: 120 } }
  const divergent = new Set(replicas.map((r) => r.value)).size > 1

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Vive el teorema CAP" done={done}>
        (1) En modo <b>CP</b>, intenta operar desde la minoría durante una partición {goals.cpReject ? '✅' : '⬜'} · (2) En modo <b>AP</b>, escribe en ambos lados durante una partición y restaura la red para ver el conflicto {goals.apConflict ? '✅' : '⬜'}
      </ChallengeBanner>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-3 bg-grid">
          <svg viewBox="0 0 420 240" className="w-full h-auto">
            <rect x={20} y={20} width={150} height={200} rx={16} fill="none" stroke={colors.border} strokeDasharray="6 4" />
            <text x={95} y={38} textAnchor="middle" fontSize={11} fill={colors.muted} fontWeight={700}>DC-A (mayoría)</text>
            <rect x={260} y={60} width={140} height={120} rx={16} fill="none" stroke={colors.border} strokeDasharray="6 4" />
            <text x={330} y={78} textAnchor="middle" fontSize={11} fill={colors.muted} fontWeight={700}>DC-B</text>
            {[['N1', 'N2'], ['N1', 'N3'], ['N2', 'N3']].map(([a, b]) => {
              const cut = partitioned && (a === 'N3' || b === 'N3')
              return <line key={a + b} x1={P[a].x} y1={P[a].y} x2={P[b].x} y2={P[b].y} stroke={cut ? colors.bad : colors.border} strokeWidth={2} strokeDasharray={cut ? '4 6' : undefined} opacity={cut ? 0.7 : 1} />
            })}
            <AnimatePresence>
              {partitioned && (
                <motion.text initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} x={215} y={128} textAnchor="middle" fontSize={26} style={{ transformOrigin: '215px 120px' }}>
                  ✂️
                </motion.text>
              )}
            </AnimatePresence>
            {packets.map((p) => (
              <motion.circle key={p.id} r={6} fill={colors.accent} initial={{ cx: P[p.from].x, cy: P[p.from].y }} animate={{ cx: P[p.to].x, cy: P[p.to].y }} transition={{ duration: 0.6 }} />
            ))}
            {replicas.map((r) => (
              <g key={r.id}>
                <circle cx={P[r.id].x} cy={P[r.id].y} r={30} fill={colors.surface} stroke={divergent ? colors.warn : colors.good} strokeWidth={3} />
                <motion.text key={r.value + r.ts} initial={{ scale: 1.6 }} animate={{ scale: 1 }} x={P[r.id].x} y={P[r.id].y + 8} textAnchor="middle" fontSize={22} style={{ transformOrigin: `${P[r.id].x}px ${P[r.id].y}px` }}>
                  {r.value}
                </motion.text>
                <text x={P[r.id].x} y={P[r.id].y + 46} textAnchor="middle" fontSize={10} fill={colors.muted}>
                  {r.id} · t={r.ts}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="grid gap-3 content-start">
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Ante una partición, priorizo…</div>
            <Segmented value={mode} onChange={setMode} options={[{ id: 'CP', label: 'CP · Consistencia' }, { id: 'AP', label: 'AP · Disponibilidad' }]} />
          </div>
          <button className={`btn ${partitioned ? 'btn-primary' : 'btn-ghost !border-bad/60'}`} onClick={toggle}>
            {partitioned ? '🔗 Restaurar red' : '✂️ Cortar la red'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost text-xs" onClick={() => write('A')}>✏️ Escribir en A</button>
            <button className="btn btn-ghost text-xs" onClick={() => write('B')}>✏️ Escribir en B</button>
            <button className="btn btn-ghost text-xs" onClick={() => read('A')}>📖 Leer en A</button>
            <button className="btn btn-ghost text-xs" onClick={() => read('B')}>📖 Leer en B</button>
          </div>
          <p className="text-[11px] text-muted">Quórum = 2 de 3. En CP la minoría (DC-B) no puede operar durante la partición. En AP todos aceptan, pero las réplicas divergen.</p>
        </div>
      </div>

      <div className="card p-3 min-h-[9rem]">
        <div className="text-xs font-semibold text-muted mb-2">Registro de eventos</div>
        <div className="grid gap-1">
          <AnimatePresence initial={false}>
            {log.map((l) => (
              <motion.div key={l.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-xs font-mono" style={{ color: l.tone === 'bad' ? colors.bad : l.tone === 'warn' ? colors.warn : l.tone === 'ok' ? colors.good : colors.muted }}>
                {l.text}
              </motion.div>
            ))}
          </AnimatePresence>
          {!log.length && <div className="text-xs text-muted">Empieza escribiendo un valor, luego corta la red.</div>}
        </div>
      </div>
    </div>
  )
}
