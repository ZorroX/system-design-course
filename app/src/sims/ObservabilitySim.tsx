import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { ChallengeBanner, Segmented } from '@/components/ui'
import { useColors, useForceRender, useInterval } from '@/lib/hooks'
import { shuffle } from '@/lib/format'
import type { SimProps } from './index'

type Svc = 'gateway' | 'orders' | 'payments' | 'inventory' | 'inventory-db' | 'recommendations'
const SERVICES: Svc[] = ['gateway', 'orders', 'payments', 'inventory', 'inventory-db', 'recommendations']
const NORMAL: Record<Svc, { rate: number; err: number; p99: number }> = {
  gateway: { rate: 820, err: 0.3, p99: 320 },
  orders: { rate: 240, err: 0.2, p99: 260 },
  payments: { rate: 230, err: 0.4, p99: 140 },
  inventory: { rate: 240, err: 0.1, p99: 45 },
  'inventory-db': { rate: 480, err: 0, p99: 12 },
  recommendations: { rate: 580, err: 0.2, p99: 110 },
}

interface Scenario {
  alert: string
  impact: Partial<Record<Svc, { rate?: number; err?: number; p99?: number }>>
  trace: { svc: Svc; name: string; start: number; dur: number; depth: number; error?: string }[]
  logs: { svc: Svc; level: 'INFO' | 'WARN' | 'ERROR'; msg: string }[]
  culprit: Svc
  fixes: { text: string; ok: boolean }[]
  explain: string
}

const SCENARIOS: Scenario[] = [
  {
    alert: '🚨 SLO de checkout en riesgo: error rate de POST /checkout = 11% (objetivo < 0.1%)',
    impact: { gateway: { err: 11 }, orders: { err: 11, p99: 420 }, payments: { err: 24, p99: 380 } },
    trace: [
      { svc: 'gateway', name: 'POST /checkout', start: 0, dur: 460, depth: 0, error: '502' },
      { svc: 'orders', name: 'POST /orders', start: 8, dur: 440, depth: 1, error: '500' },
      { svc: 'inventory', name: 'POST /reserve', start: 18, dur: 42, depth: 2 },
      { svc: 'inventory-db', name: 'SELECT stock', start: 22, dur: 11, depth: 3 },
      { svc: 'payments', name: 'POST /charge', start: 64, dur: 150, depth: 2, error: '500 NullPointerException' },
      { svc: 'payments', name: 'POST /charge (retry 1)', start: 220, dur: 210, depth: 2, error: '500 NullPointerException' },
    ],
    logs: [
      { svc: 'payments', level: 'INFO', msg: '14:02:11 Deployed version v2.3.0 (3/3 pods ready)' },
      { svc: 'payments', level: 'ERROR', msg: '14:02:40 NullPointerException at ChargeService.applyDiscount(ChargeService.java:88) trace_id=4bf9…' },
      { svc: 'orders', level: 'WARN', msg: '14:02:40 payments returned 500, retrying (1/1) trace_id=4bf9…' },
      { svc: 'gateway', level: 'ERROR', msg: '14:02:41 POST /checkout -> 502 upstream orders failed' },
    ],
    culprit: 'payments',
    fixes: [
      { text: 'Rollback de payments a v2.2.9', ok: true },
      { text: 'Escalar payments a 20 instancias', ok: false },
      { text: 'Subir el timeout de orders a 30 s', ok: false },
      { text: 'Reiniciar la base de datos de inventario', ok: false },
    ],
    explain: 'Los errores empezaron justo tras el deploy v2.3.0 y la traza muestra el 500 en payments; orders y gateway solo propagan el error. Más instancias de un código roto siguen rotas: rollback primero, investigar después.',
  },
  {
    alert: '🐢 Latencia: p99 de POST /checkout = 2.4 s (objetivo < 500 ms). Error rate normal.',
    impact: { gateway: { p99: 2400 }, orders: { p99: 2330 }, inventory: { p99: 2250 }, 'inventory-db': { p99: 2150 } },
    trace: [
      { svc: 'gateway', name: 'POST /checkout', start: 0, dur: 2380, depth: 0 },
      { svc: 'orders', name: 'POST /orders', start: 8, dur: 2360, depth: 1 },
      { svc: 'inventory', name: 'POST /reserve', start: 15, dur: 2240, depth: 2 },
      { svc: 'inventory-db', name: 'SELECT * FROM stock WHERE sku=? AND wh=?', start: 20, dur: 2190, depth: 3 },
      { svc: 'payments', name: 'POST /charge', start: 2262, dur: 95, depth: 2 },
    ],
    logs: [
      { svc: 'inventory', level: 'INFO', msg: '09:30:02 Migration 042_cleanup applied: DROP INDEX idx_stock_sku_wh' },
      { svc: 'inventory-db', level: 'WARN', msg: '09:31:15 slow query 2104 ms: SELECT * FROM stock WHERE sku=$1 AND wh=$2 (rows examined: 8,400,000)' },
      { svc: 'orders', level: 'WARN', msg: '09:31:16 upstream inventory took 2251 ms' },
      { svc: 'payments', level: 'INFO', msg: '09:31:16 charge ok in 95 ms' },
    ],
    culprit: 'inventory-db',
    fixes: [
      { text: 'Recrear el índice (sku, wh) que borró la migración 042', ok: true },
      { text: 'Agregar más réplicas de orders', ok: false },
      { text: 'Cachear las respuestas de payments', ok: false },
      { text: 'Subir el timeout del gateway a 10 s', ok: false },
    ],
    explain: 'El 92% del tiempo de la traza está en una consulta de inventory-db que examina 8,4 M de filas: un full scan. Coincide con la migración que borró el índice. Escalar los servicios de arriba no acelera una consulta sin índice.',
  },
  {
    alert: '🔥 Saturación: el gateway rechaza peticiones en TODAS las rutas (home, checkout, login). p99 = 8 s.',
    impact: { gateway: { err: 18, p99: 8000 }, orders: { rate: 90 }, payments: { rate: 85 }, recommendations: { err: 35, p99: 8000 } },
    trace: [
      { svc: 'gateway', name: 'GET /home', start: 0, dur: 8030, depth: 0, error: '504' },
      { svc: 'recommendations', name: 'GET /recs/for-user', start: 6, dur: 8010, depth: 1, error: 'sin respuesta' },
    ],
    logs: [
      { svc: 'recommendations', level: 'WARN', msg: '20:15:03 CPU 99%, GC pause 1.8 s (new model v7 loaded)' },
      { svc: 'gateway', level: 'WARN', msg: '20:15:09 call to recommendations took 8012 ms (no timeout configured)' },
      { svc: 'gateway', level: 'ERROR', msg: '20:15:10 Thread pool exhausted (200/200 busy): rejecting POST /checkout' },
      { svc: 'orders', level: 'INFO', msg: '20:15:10 traffic dropped 60% (upstream rejecting)' },
    ],
    culprit: 'recommendations',
    fixes: [
      { text: 'Timeout corto + circuit breaker con fallback (recomendaciones genéricas) en el gateway', ok: true },
      { text: 'Subir el pool de hilos del gateway a 2.000', ok: false },
      { text: 'Rollback de payments', ok: false },
      { text: 'Agregar un índice en inventory', ok: false },
    ],
    explain: 'Un servicio NO crítico (recomendaciones) se volvió lento y, sin timeout, cada llamada retuvo un hilo del gateway 8 s hasta agotar el pool: fallo en cascada que tumbó también checkout. Más hilos solo retrasa el colapso; la solución es aislar la dependencia (timeout + breaker + fallback).',
  },
]

function Spark({ data, color, max }: { data: number[]; color: string; max: number }) {
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (Math.min(v, max) / max) * 28}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const LEN = 30
const START = 18 // punto donde empieza el incidente en la serie

export default function ObservabilitySim({ done, onComplete }: SimProps) {
  const c = useColors()
  const render = useForceRender()
  const [idx, setIdx] = useState(0)
  const [view, setView] = useState<'dash' | 'trace' | 'logs'>('dash')
  const [culprit, setCulprit] = useState<Svc | null>(null)
  const [fix, setFix] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [solved, setSolved] = useState<boolean[]>(SCENARIOS.map(() => false))
  const sc = SCENARIOS[idx]
  const fixes = useMemo(() => shuffle(sc.fixes, idx * 7 + 3), [sc, idx])

  // series vivas: los últimos puntos reflejan el incidente
  const [tick, setTick] = useState(0)
  useInterval(() => {
    setTick((t) => t + 1)
    render()
  }, 1000)
  const series = useMemo(() => {
    const out: Record<Svc, { err: number[]; p99: number[]; rate: number[] }> = {} as never
    for (const s of SERVICES) {
      const n = NORMAL[s]
      const inc = { ...n, ...sc.impact[s] }
      const mk = (k: 'err' | 'p99' | 'rate') =>
        Array.from({ length: LEN }, (_, i) => {
          const base = i + Math.min(tick, 6) >= START + 6 ? inc[k] : n[k]
          const noise = 1 + Math.sin((i + tick) * 1.7 + s.length) * 0.06
          return base * noise
        })
      out[s] = { err: mk('err'), p99: mk('p99'), rate: mk('rate') }
    }
    return out
  }, [sc, tick])

  const submit = () => {
    if (!culprit || fix === null) return
    const ok = culprit === sc.culprit && fixes[fix].ok
    if (ok) {
      const next = solved.map((v, i) => (i === idx ? true : v))
      setSolved(next)
      if (!done && next.every(Boolean)) onComplete()
      setFeedback({ ok: true, text: sc.explain })
    } else if (culprit !== sc.culprit) setFeedback({ ok: false, text: 'Ese servicio muestra síntomas, pero ¿es la causa o solo propaga el problema? Mira dónde se va el tiempo (o nace el error) en la traza y qué dicen sus logs.' })
    else setFeedback({ ok: false, text: 'Bien identificado el servicio. Pero ese arreglo no ataca la causa raíz; revisa los logs.' })
  }
  const goto = (i: number) => {
    setIdx(i)
    setView('dash')
    setCulprit(null)
    setFix(null)
    setFeedback(null)
  }

  const total = Math.max(...sc.trace.map((t) => t.start + t.dur))

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Resuelve los 3 incidentes" done={done}>
        Encuentra el servicio <b>causante</b> (no solo el que muestra síntomas) y el arreglo correcto. {solved.filter(Boolean).length}/3 resueltos.
      </ChallengeBanner>

      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((_, i) => (
          <button key={i} onClick={() => goto(i)} className={`chip !text-xs !py-1 ${i === idx ? '!bg-accent !text-[#04131a] !border-accent' : ''}`}>
            {solved[i] ? '✅' : '🚨'} Incidente {i + 1}
          </button>
        ))}
      </div>

      <motion.div key={idx} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-bad/50 bg-bad/10 px-4 py-3 text-sm font-semibold">
        {sc.alert}
      </motion.div>

      <Segmented value={view} onChange={setView} options={[{ id: 'dash', label: '📊 Dashboard RED' }, { id: 'trace', label: '🧵 Traza de ejemplo' }, { id: 'logs', label: '📜 Logs' }]} />

      {view === 'dash' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SERVICES.map((s) => {
            const d = series[s]
            const err = d.err[LEN - 1]
            const p99 = d.p99[LEN - 1]
            const rate = d.rate[LEN - 1]
            const bad = err > 2 || p99 > NORMAL[s].p99 * 3
            return (
              <div key={s} className={`card p-3 ${bad ? 'border-bad/50' : ''}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-xs font-bold">{s}</span>
                  <span className={`w-2 h-2 rounded-full ${bad ? 'bg-bad animate-pulse' : 'bg-good'}`} />
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] text-muted">
                  <div>
                    rate<div className="text-text font-mono text-xs">{Math.round(rate)}/s</div>
                  </div>
                  <div>
                    err<div className={`font-mono text-xs ${err > 2 ? 'text-bad' : 'text-text'}`}>{err.toFixed(1)}%</div>
                  </div>
                  <div>
                    p99<div className={`font-mono text-xs ${p99 > NORMAL[s].p99 * 3 ? 'text-bad' : 'text-text'}`}>{p99 >= 1000 ? `${(p99 / 1000).toFixed(1)}s` : `${Math.round(p99)}ms`}</div>
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Spark data={d.err} color={c.bad} max={Math.max(5, ...d.err)} />
                  <Spark data={d.p99} color={c.accent} max={Math.max(NORMAL[s].p99 * 2, ...d.p99)} />
                </div>
                <div className="flex justify-between text-[9px] text-muted">
                  <span>errores</span>
                  <span>p99</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'trace' && (
        <div className="card p-4 overflow-x-auto">
          <div className="min-w-[34rem] grid gap-1.5">
            <div className="flex text-[10px] text-muted pl-56">
              <span className="flex-1">0 ms</span>
              <span>{total} ms</span>
            </div>
            {sc.trace.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-56 shrink-0 truncate font-mono" style={{ paddingLeft: t.depth * 12 }}>
                  <span className="text-accent">{t.svc}</span> <span className="text-muted">{t.name}</span>
                </span>
                <div className="relative flex-1 h-5 bg-surface-2 rounded">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(t.dur / total) * 100}%` }}
                    transition={{ delay: i * 0.08 }}
                    className="absolute h-full rounded flex items-center px-1 text-[9px] font-mono text-[#04131a] overflow-hidden whitespace-nowrap"
                    style={{ left: `${(t.start / total) * 100}%`, background: t.error ? c.bad : c.accent }}
                  >
                    {t.dur} ms{t.error ? ` · ${t.error}` : ''}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3">Cada barra es un span; la indentación muestra quién llamó a quién. Busca el span más profundo donde nace el tiempo o el error.</p>
        </div>
      )}

      {view === 'logs' && (
        <div className="card p-3 font-mono text-[11px] grid gap-1 overflow-x-auto">
          {sc.logs.map((l, i) => (
            <div key={i} className="whitespace-nowrap">
              <span className={l.level === 'ERROR' ? 'text-bad' : l.level === 'WARN' ? 'text-warn' : 'text-muted'}>{l.level.padEnd(5)}</span> <span className="text-accent">[{l.svc}]</span> {l.msg}
            </div>
          ))}
        </div>
      )}

      <div className="card p-4 grid gap-3">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">Tu diagnóstico</div>
        <div>
          <div className="text-xs text-muted mb-1">1. ¿Qué servicio es la causa raíz?</div>
          <div className="flex flex-wrap gap-1.5">
            {SERVICES.map((s) => (
              <button key={s} onClick={() => { setCulprit(s); setFeedback(null) }} className={`chip font-mono !text-xs !py-1 ${culprit === s ? '!bg-accent !text-[#04131a] !border-accent' : ''}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted mb-1">2. ¿Qué haces primero?</div>
          <div className="grid gap-1.5">
            {fixes.map((f, i) => (
              <button key={f.text} onClick={() => { setFix(i); setFeedback(null) }} className={`text-left text-sm rounded-lg border px-3 py-2 ${fix === i ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'}`}>
                {f.text}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary justify-self-start" disabled={!culprit || fix === null || solved[idx]} onClick={submit}>
          {solved[idx] ? 'Resuelto ✓' : 'Confirmar diagnóstico'}
        </button>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border px-4 py-3 text-sm ${feedback.ok ? 'border-good/50 bg-good/10' : 'border-warn/50 bg-warn/10'}`}>
            <div className="font-bold mb-1">{feedback.ok ? '✅ ¡Incidente resuelto!' : '🤔 Todavía no'}</div>
            <div className="text-muted">{feedback.text}</div>
            {feedback.ok && idx < SCENARIOS.length - 1 && (
              <button className="btn btn-ghost mt-2 !py-1 text-xs" onClick={() => goto(idx + 1)}>
                Siguiente incidente →
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
