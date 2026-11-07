import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { ChallengeBanner, Segmented } from '@/components/ui'
import type { SimProps } from './index'

type Svc = 'orders' | 'inventory' | 'payments' | 'shipping'
type FailAt = 'none' | 'inventory' | 'payments' | 'shipping'
interface World {
  order: 'NONE' | 'PENDING' | 'APPROVED' | 'CANCELLED'
  stock: number
  charges: number
  refunds: number
  shipped: boolean
}
interface Event {
  svc: Svc
  kind: 'do' | 'fail' | 'comp' | 'dup' | 'event'
  label: string
  world: World
}

const SVC_INFO: Record<Svc, { icon: string; name: string }> = {
  orders: { icon: '🧾', name: 'Pedidos' },
  inventory: { icon: '📦', name: 'Inventario' },
  payments: { icon: '💳', name: 'Pagos' },
  shipping: { icon: '🚚', name: 'Envíos' },
}

/** Calcula de antemano la secuencia de pasos de la saga según la configuración. */
function plan(failAt: FailAt, compensate: boolean, dupRetry: boolean, idempotent: boolean): Event[] {
  const w: World = { order: 'NONE', stock: 5, charges: 0, refunds: 0, shipped: false }
  const ev: Event[] = []
  const push = (svc: Svc, kind: Event['kind'], label: string) => ev.push({ svc, kind, label, world: { ...w } })
  const done: Svc[] = []

  w.order = 'PENDING'
  push('orders', 'do', 'Crear pedido (PENDING)')
  done.push('orders')

  const steps: { svc: Svc; label: string; apply: () => void }[] = [
    { svc: 'inventory', label: 'Reservar 2 unidades', apply: () => (w.stock -= 2) },
    { svc: 'payments', label: 'Cobrar $49,99', apply: () => (w.charges += 1) },
    { svc: 'shipping', label: 'Programar envío', apply: () => (w.shipped = true) },
  ]
  for (const s of steps) {
    if (failAt === s.svc) {
      push(s.svc, 'fail', `${s.label}: ✘ FALLA`)
      if (!compensate) {
        push('orders', 'event', 'Sin compensaciones: la saga se detiene aquí')
        return ev
      }
      for (const prev of [...done].reverse()) {
        if (prev === 'shipping') continue
        if (prev === 'payments') w.refunds = w.charges
        if (prev === 'inventory') w.stock += 2
        if (prev === 'orders') w.order = 'CANCELLED'
        push(prev, 'comp', prev === 'payments' ? 'Compensar: reembolsar' : prev === 'inventory' ? 'Compensar: liberar stock' : 'Compensar: cancelar pedido')
      }
      return ev
    }
    s.apply()
    push(s.svc, 'do', s.label)
    done.push(s.svc)
    if (s.svc === 'payments' && dupRetry) {
      // el orquestador no recibió la respuesta (timeout de red) y reintenta el cobro
      if (!idempotent) w.charges += 1
      push('payments', 'dup', idempotent ? 'Reintento por timeout: ya procesado (idempotency key) ✓' : 'Reintento por timeout: ¡se cobra OTRA vez!')
    }
  }
  w.order = 'APPROVED'
  push('orders', 'do', 'Aprobar pedido')
  return ev
}

function verdict(w: World): { ok: boolean; text: string } {
  if (w.order === 'APPROVED' && w.stock === 3 && w.charges === 1 && w.refunds === 0 && w.shipped) return { ok: true, text: 'Consistente: pedido aprobado, stock descontado, un solo cobro y envío programado.' }
  if (w.order === 'CANCELLED' && w.stock === 5 && w.charges === w.refunds && !w.shipped) return { ok: true, text: 'Consistente: todo se deshizo. Pedido cancelado, stock devuelto y dinero reembolsado.' }
  const issues: string[] = []
  if (w.charges - w.refunds > 1) issues.push('el cliente pagó dos veces')
  if (w.order === 'PENDING') issues.push('el pedido quedó PENDING para siempre')
  if (w.stock < 5 && w.order !== 'APPROVED') issues.push('hay stock reservado de un pedido que no existirá')
  if (w.charges > w.refunds && w.order !== 'APPROVED') issues.push('se cobró sin entregar nada')
  return { ok: false, text: `Inconsistente: ${issues.join(', ') || 'los servicios no coinciden'}.` }
}

export default function SagaSim({ done, onComplete }: SimProps) {
  const [mode, setMode] = useState<'orch' | 'chor'>('orch')
  const [failAt, setFailAt] = useState<FailAt>('shipping')
  const [compensate, setCompensate] = useState(false)
  const [dupRetry, setDupRetry] = useState(false)
  const [idempotent, setIdempotent] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [step, setStep] = useState(-1)
  const [goals, setGoals] = useState({ broken: false, rollback: false, idem: false })
  const timer = useRef<number | undefined>(undefined)

  const running = step >= 0 && step < events.length - 1
  const finished = events.length > 0 && step === events.length - 1
  const world: World = step >= 0 ? events[step].world : { order: 'NONE', stock: 5, charges: 0, refunds: 0, shipped: false }
  const current = step >= 0 ? events[step] : null

  useEffect(() => {
    if (!running) return
    timer.current = window.setTimeout(() => setStep((s) => s + 1), 750)
    return () => window.clearTimeout(timer.current)
  }, [running, step])

  useEffect(() => {
    if (!finished) return
    const v = verdict(world)
    setGoals((g) => ({
      broken: g.broken || !v.ok,
      rollback: g.rollback || (v.ok && failAt === 'shipping' && compensate),
      idem: g.idem || (v.ok && dupRetry && idempotent),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  useEffect(() => {
    if (!done && goals.broken && goals.rollback && goals.idem) onComplete()
  }, [goals, done, onComplete])

  const run = () => {
    const ev = plan(failAt, compensate, dupRetry, idempotent)
    setEvents(ev)
    setStep(0)
  }
  const reset = () => {
    window.clearTimeout(timer.current)
    setEvents([])
    setStep(-1)
  }

  const order: Svc[] = ['orders', 'inventory', 'payments', 'shipping']
  const v = finished ? verdict(world) : null

  const stateOf = (s: Svc) => {
    switch (s) {
      case 'orders':
        return world.order === 'NONE' ? '—' : world.order
      case 'inventory':
        return `stock: ${world.stock}${world.stock < 5 ? ` (${5 - world.stock} reservadas)` : ''}`
      case 'payments':
        return world.charges === 0 ? 'sin cobros' : `cobros: ${world.charges}${world.refunds ? ` · reembolsos: ${world.refunds}` : ''}`
      case 'shipping':
        return world.shipped ? 'envío programado' : '—'
    }
  }

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Rompe y arregla la saga" done={done}>
        (1) Deja el sistema <b>inconsistente</b> {goals.broken ? '✅' : '⬜'} · (2) Con fallo en <b>envíos</b>, logra un rollback consistente {goals.rollback ? '✅' : '⬜'} · (3) Con <b>reintento duplicado</b> del cobro, termina consistente {goals.idem ? '✅' : '⬜'}
      </ChallengeBanner>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-4 bg-grid">
          {/* Orquestador o bus de eventos */}
          <div className="flex justify-center mb-4">
            {mode === 'orch' ? (
              <motion.div animate={{ scale: running ? [1, 1.04, 1] : 1 }} transition={{ repeat: running ? Infinity : 0, duration: 0.75 }} className="rounded-xl border-2 border-violet bg-violet/10 px-4 py-2 text-sm font-bold">
                🎼 Orquestador de la saga
              </motion.div>
            ) : (
              <div className="w-full rounded-xl border-2 border-pink/60 bg-pink/10 px-4 py-2 text-sm font-bold text-center">📢 Bus de eventos (Kafka / EventBridge)</div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {order.map((s) => {
              const isCur = current?.svc === s
              const tone = isCur ? (current!.kind === 'fail' ? 'border-bad bg-bad/15' : current!.kind === 'comp' ? 'border-warn bg-warn/15' : current!.kind === 'dup' ? (idempotent ? 'border-good bg-good/15' : 'border-bad bg-bad/15') : 'border-accent bg-accent/15') : 'border-border bg-surface'
              return (
                <motion.div key={s} animate={{ y: isCur ? -4 : 0 }} className={`relative rounded-xl border-2 p-3 transition-colors ${tone}`}>
                  {isCur && (
                    <motion.span initial={{ y: -36, opacity: 0 }} animate={{ y: -14, opacity: 1 }} className="absolute left-1/2 -translate-x-1/2 -top-2 text-lg">
                      {current!.kind === 'comp' ? '↩️' : current!.kind === 'fail' ? '💥' : mode === 'orch' ? '📩' : '📨'}
                    </motion.span>
                  )}
                  <div className="text-2xl">{SVC_INFO[s].icon}</div>
                  <div className="font-bold text-sm">{SVC_INFO[s].name}</div>
                  <div className="text-[11px] text-muted font-mono mt-1 min-h-[2rem]">{stateOf(s)}</div>
                  <div className="text-[9px] text-muted">DB propia</div>
                </motion.div>
              )
            })}
          </div>
          <div className="mt-4 grid gap-1 min-h-[7rem]">
            <AnimatePresence initial={false}>
              {events.slice(0, step + 1).map((e, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={`text-xs font-mono ${e.kind === 'fail' || (e.kind === 'dup' && !idempotent) ? 'text-bad' : e.kind === 'comp' ? 'text-warn' : e.kind === 'event' ? 'text-muted' : 'text-text'}`}>
                  {i + 1}. [{SVC_INFO[e.svc].name}] {mode === 'chor' && e.kind === 'do' ? `${e.label} → publica evento` : e.label}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {v && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className={`mt-3 rounded-xl border px-4 py-3 text-sm ${v.ok ? 'border-good/50 bg-good/10' : 'border-bad/50 bg-bad/10'}`}>
              <b>{v.ok ? '✅ ' : '❌ '}</b>
              {v.text}
            </motion.div>
          )}
        </div>

        <div className="grid gap-3 content-start">
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Estilo</div>
            <Segmented size="sm" value={mode} onChange={setMode} options={[{ id: 'orch', label: 'Orquestación' }, { id: 'chor', label: 'Coreografía' }]} />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Provocar fallo en</div>
            <Segmented size="sm" value={failAt} onChange={setFailAt} options={[{ id: 'none', label: 'Ninguno' }, { id: 'inventory', label: 'Inventario' }, { id: 'payments', label: 'Pagos' }, { id: 'shipping', label: 'Envíos' }]} />
          </div>
          <label className="text-xs flex items-center gap-2 text-muted">
            <input type="checkbox" checked={compensate} onChange={(e) => setCompensate(e.target.checked)} /> Compensaciones activadas
          </label>
          <label className="text-xs flex items-center gap-2 text-muted">
            <input type="checkbox" checked={dupRetry} onChange={(e) => setDupRetry(e.target.checked)} /> Timeout de red: el cobro se reintenta
          </label>
          <label className={`text-xs flex items-center gap-2 ${dupRetry ? 'text-muted' : 'text-muted/40'}`}>
            <input type="checkbox" disabled={!dupRetry} checked={idempotent} onChange={(e) => setIdempotent(e.target.checked)} /> Pagos idempotente (idempotency key)
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={run} disabled={running}>
              <Play size={16} /> Ejecutar saga
            </button>
            <button className="btn btn-ghost" onClick={reset} aria-label="Reiniciar">
              <RotateCcw size={16} />
            </button>
          </div>
          <p className="text-[11px] text-muted">No hay transacción global: cada servicio confirma en su propia base de datos. Si un paso falla, solo las compensaciones pueden devolver el sistema a un estado coherente.</p>
        </div>
      </div>
    </div>
  )
}
