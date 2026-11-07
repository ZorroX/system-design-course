import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Zap } from 'lucide-react'
import { ChallengeBanner, Segmented, Slider, Stat } from '@/components/ui'
import { useColors, useForceRender, useInterval } from '@/lib/hooks'
import { poisson } from '@/lib/random'
import type { SimProps } from './index'

type Algo = 'token' | 'leaky' | 'fixed' | 'sliding'
type Pattern = 'steady' | 'bursty' | 'attack'
const TICK = 0.05
const SPAN = 6 // segundos visibles en la línea de tiempo

export default function RateLimiterSim({ done, onComplete }: SimProps) {
  const colors = useColors()
  const render = useForceRender()
  const [algo, setAlgo] = useState<Algo>('fixed')
  const [pattern, setPattern] = useState<Pattern>('steady')
  const [limit, setLimit] = useState(10)
  const [burstCap, setBurstCap] = useState(10)
  const [rate, setRate] = useState(8)

  const sim = useRef({
    t: 0,
    tokens: 10,
    queue: [] as number[],
    leakAcc: 0,
    winStart: 0,
    winCount: 0,
    log: [] as number[],
    events: [] as { t: number; ok: boolean; queued?: boolean }[],
    allowedTimes: [] as number[],
    perSec: [] as { s: number; ok: number; ko: number }[],
    maxInSecond: 0,
    pending: 0,
  })

  const arrive = (s: typeof sim.current) => {
    let ok = false
    let queued = false
    switch (algo) {
      case 'token':
        if (s.tokens >= 1) {
          s.tokens -= 1
          ok = true
        }
        break
      case 'leaky':
        if (s.queue.length < burstCap) {
          s.queue.push(s.t)
          queued = true
        }
        break
      case 'fixed':
        if (s.winCount < limit) {
          s.winCount++
          ok = true
        }
        break
      case 'sliding':
        s.log = s.log.filter((x) => s.t - x < 1)
        if (s.log.length < limit) {
          s.log.push(s.t)
          ok = true
        }
        break
    }
    s.events.push({ t: s.t, ok: ok || queued, queued })
    if (ok) s.allowedTimes.push(s.t)
    const sec = Math.floor(s.t)
    const last = s.perSec[s.perSec.length - 1]
    const row = last && last.s === sec ? last : (s.perSec.push({ s: sec, ok: 0, ko: 0 }), s.perSec[s.perSec.length - 1])
    if (ok || queued) row.ok++
    else row.ko++
  }

  useInterval(() => {
    const s = sim.current
    s.t = +(s.t + TICK).toFixed(3)
    // estado de algoritmos
    s.tokens = Math.min(burstCap, s.tokens + limit * TICK)
    if (s.t - s.winStart >= 1) {
      s.winStart = Math.floor(s.t)
      s.winCount = 0
    }
    if (algo === 'leaky') {
      s.leakAcc += limit * TICK
      while (s.leakAcc >= 1 && s.queue.length) {
        s.queue.shift()
        s.leakAcc -= 1
        s.allowedTimes.push(s.t)
      }
      if (!s.queue.length) s.leakAcc = Math.min(s.leakAcc, 1)
    }
    // llegadas
    let lambda = rate
    if (pattern === 'attack') lambda = rate * 5
    let n = poisson(lambda * TICK)
    if (pattern === 'bursty' && Math.abs((s.t % 3) - 0.5) < TICK / 2) n += 25
    n += s.pending
    s.pending = 0
    for (let i = 0; i < n; i++) arrive(s)
    // limpieza y métricas
    s.events = s.events.filter((e) => s.t - e.t < SPAN)
    s.allowedTimes = s.allowedTimes.filter((x) => s.t - x < 1)
    s.perSec = s.perSec.slice(-20)
    const inLastSecond = s.allowedTimes.length
    s.maxInSecond = Math.max(s.maxInSecond * 0.999, inLastSecond)
    if (!done && algo === 'fixed' && inLastSecond > limit * 1.5) onComplete()
    render()
  }, TICK * 1000)

  const s = sim.current
  const W = 600
  const xOf = (t: number) => W - ((s.t - t) / SPAN) * W
  const winProgress = s.t - s.winStart
  const allowed1s = s.allowedTimes.length

  const changeAlgo = (a: Algo) => {
    const x = sim.current
    x.tokens = burstCap
    x.queue = []
    x.winCount = 0
    x.log = []
    x.maxInSecond = 0
    setAlgo(a)
  }

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="El bug del borde de ventana" done={done}>
        Con <b>Fixed window</b>, consigue que pasen más de <b>{Math.floor(limit * 1.5)}</b> peticiones en un mismo segundo (1,5× el límite). Pista: dispara una ráfaga justo antes de que la barra de ventana se reinicie y otra justo después.
      </ChallengeBanner>

      <div className="card p-3 bg-grid">
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>← hace {SPAN}s</span>
          <span className="font-semibold">Peticiones entrantes (verde = aceptada{algo === 'leaky' ? '/encolada' : ''}, rojo = 429)</span>
          <span>ahora →</span>
        </div>
        <svg viewBox={`0 0 ${W} 80`} className="w-full h-20">
          {algo === 'fixed' &&
            Array.from({ length: SPAN + 1 }).map((_, i) => {
              const t = Math.floor(s.t) - i
              const x = xOf(t)
              return x >= 0 ? <line key={t} x1={x} x2={x} y1={0} y2={80} stroke={colors.warn} strokeDasharray="3 3" opacity={0.6} /> : null
            })}
          {s.events.map((e, i) => (
            <rect key={i} x={xOf(e.t) - 1.5} y={e.ok ? 12 + (i % 5) * 6 : 46 + (i % 5) * 6} width={3} height={10} rx={1} fill={e.ok ? (e.queued ? colors.accent : colors.good) : colors.bad} />
          ))}
          <text x={4} y={10} fontSize={9} fill={colors.muted}>aceptadas</text>
          <text x={4} y={78} fontSize={9} fill={colors.muted}>rechazadas</text>
        </svg>
      </div>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-4 flex flex-col sm:flex-row items-center gap-6 justify-center min-h-[11rem]">
          {algo === 'token' && (
            <div className="text-center">
              <div className="relative w-28 h-32 border-4 border-t-0 rounded-b-3xl border-accent/70 overflow-hidden flex flex-wrap-reverse content-start gap-1 p-1.5">
                {Array.from({ length: Math.floor(s.tokens) }).map((_, i) => (
                  <motion.div key={i} initial={{ scale: 0, y: -40 }} animate={{ scale: 1, y: 0 }} className="w-4 h-4 rounded-full bg-warn shadow" />
                ))}
              </div>
              <div className="text-xs text-muted mt-2">🪙 {s.tokens.toFixed(1)} / {burstCap} tokens · +{limit}/s</div>
            </div>
          )}
          {algo === 'leaky' && (
            <div className="text-center">
              <div className="w-28 h-32 border-4 border-t-0 rounded-b-xl border-accent/70 flex flex-col-reverse gap-0.5 p-1.5 overflow-hidden">
                {s.queue.map((_, i) => (
                  <motion.div layout key={i} className="h-2.5 rounded bg-accent/80" />
                ))}
              </div>
              <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 / Math.max(1, limit) * 4 }} className="text-accent text-lg leading-none">💧</motion.div>
              <div className="text-xs text-muted">cola {s.queue.length}/{burstCap} · sale a {limit}/s (añade latencia)</div>
            </div>
          )}
          {(algo === 'fixed' || algo === 'sliding') && (
            <div className="w-full max-w-sm">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>{algo === 'fixed' ? `Ventana [${Math.floor(s.t)}s, ${Math.floor(s.t) + 1}s)` : 'Último segundo exacto'}</span>
                <span className="font-mono text-text">{algo === 'fixed' ? s.winCount : s.log.filter((x) => s.t - x < 1).length}/{limit}</span>
              </div>
              <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-warn" style={{ width: `${(algo === 'fixed' ? winProgress : 1) * 100}%` }} />
              </div>
              <div className="text-[11px] text-muted mt-2">
                {algo === 'fixed' ? 'La barra muestra el avance de la ventana actual. Al llegar al final, el contador vuelve a 0.' : 'Guarda el timestamp de cada petición: exacto pero cuesta memoria por cliente.'}
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="text-xs text-muted">Aceptadas en el último segundo</div>
            <motion.div key={allowed1s} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-4xl font-extrabold tabular-nums" style={{ color: allowed1s > limit ? colors.bad : colors.text }}>
              {allowed1s}
            </motion.div>
            <div className="text-xs text-muted">límite: {limit}/s</div>
          </div>
        </div>

        <div className="grid gap-3 content-start">
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Algoritmo</div>
            <Segmented size="sm" value={algo} onChange={changeAlgo} options={[{ id: 'token', label: 'Token bucket' }, { id: 'leaky', label: 'Leaky bucket' }, { id: 'fixed', label: 'Fixed window' }, { id: 'sliding', label: 'Sliding log' }]} />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Tráfico</div>
            <Segmented size="sm" value={pattern} onChange={setPattern} options={[{ id: 'steady', label: 'Constante' }, { id: 'bursty', label: 'Ráfagas' }, { id: 'attack', label: 'Ataque ×5' }]} />
          </div>
          <Slider label="Tráfico base" min={1} max={30} value={rate} onChange={setRate} format={(v) => `${v} req/s`} />
          <Slider label="Límite (tasa)" min={2} max={30} value={limit} onChange={setLimit} format={(v) => `${v}/s`} />
          {(algo === 'token' || algo === 'leaky') && <Slider label={algo === 'token' ? 'Capacidad (ráfaga)' : 'Tamaño de cola'} min={1} max={40} value={burstCap} onChange={setBurstCap} />}
          <button className="btn btn-primary" onClick={() => (sim.current.pending += 15)}>
            <Zap size={16} /> Ráfaga de 15
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pico en 1 s" value={Math.round(s.maxInSecond)} color={s.maxInSecond > limit * 1.5 ? colors.bad : undefined} sub={`límite ${limit}`} />
        <Stat label="Aceptadas (20 s)" value={s.perSec.reduce((a, b) => a + b.ok, 0)} color={colors.good} />
        <Stat label="429 (20 s)" value={s.perSec.reduce((a, b) => a + b.ko, 0)} color={colors.bad} />
      </div>
      <div className="card p-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={s.perSec} margin={{ left: -18, right: 8, top: 6, bottom: 0 }}>
            <XAxis dataKey="s" tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <YAxis tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <Tooltip contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="ok" name="aceptadas" stackId="a" fill={colors.good} isAnimationActive={false} />
            <Bar dataKey="ko" name="rechazadas" stackId="a" fill={colors.bad} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
