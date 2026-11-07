import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { ChallengeBanner, Slider, Stat } from '@/components/ui'
import { useColors, useForceRender, useInterval } from '@/lib/hooks'
import { poisson } from '@/lib/random'
import type { SimProps } from './index'

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN'
const TICK = 0.05
const THREADS = 20
const OK_TIME = 0.1
const TIMEOUT = 2.0

export default function CircuitBreakerSim({ done, onComplete }: SimProps) {
  const colors = useColors()
  const render = useForceRender()
  const [failure, setFailure] = useState(0)
  const [enabled, setEnabled] = useState(true)
  const [threshold, setThreshold] = useState(50)
  const [openSecs, setOpenSecs] = useState(5)
  const rate = 12

  const sim = useRef({
    t: 0,
    state: 'CLOSED' as State,
    openedAt: 0,
    window: [] as boolean[],
    probes: 0,
    probesInFlight: 0,
    busy: [] as { end: number; ok: boolean; probe: boolean }[],
    counts: { ok: 0, fail: 0, fast: 0, rejected: 0 },
    hist: [] as { t: number; busy: number }[],
    visited: ['CLOSED'] as State[],
    transitions: [] as { from: State; to: State; t: number }[],
  })

  const go = (to: State) => {
    const s = sim.current
    if (s.state === to) return
    const from = s.state
    s.transitions = [{ from, to, t: s.t }, ...s.transitions].slice(0, 5)
    s.state = to
    if (to === 'OPEN') s.openedAt = s.t
    s.window = []
    s.probes = 0
    s.probesInFlight = 0
    if (enabled) {
      const v = s.visited
      if (v[v.length - 1] !== to) v.push(to)
      // HALF_OPEN -> CLOSED implica haber pasado antes por CLOSED y OPEN
      if (!done && from === 'HALF_OPEN' && to === 'CLOSED') onComplete()
    }
  }

  useInterval(() => {
    const s = sim.current
    s.t += TICK
    // terminan llamadas
    const still: typeof s.busy = []
    for (const c of s.busy) {
      if (c.end > s.t) {
        still.push(c)
        continue
      }
      if (c.ok) s.counts.ok++
      else s.counts.fail++
      if (!enabled) continue
      if (c.probe) {
        s.probesInFlight--
        if (!c.ok) go('OPEN')
        else if (++s.probes >= 3) go('CLOSED')
      } else if (s.state === 'CLOSED') {
        s.window = [...s.window, c.ok].slice(-10)
        if (s.window.length >= 10 && (s.window.filter((x) => !x).length / 10) * 100 >= threshold) go('OPEN')
      }
    }
    s.busy = still
    if (enabled && s.state === 'OPEN' && s.t - s.openedAt >= openSecs) go('HALF_OPEN')
    // llegan peticiones
    const n = poisson(rate * TICK)
    for (let i = 0; i < n; i++) {
      if (enabled && s.state === 'OPEN') {
        s.counts.fast++
        continue
      }
      if (enabled && s.state === 'HALF_OPEN' && s.probesInFlight + s.probes >= 3) {
        s.counts.fast++
        continue
      }
      if (s.busy.length >= THREADS) {
        s.counts.rejected++ // pool agotado: toda la app deja de responder
        continue
      }
      const ok = Math.random() * 100 >= failure
      const probe = enabled && s.state === 'HALF_OPEN'
      if (probe) s.probesInFlight++
      s.busy.push({ end: s.t + (ok ? OK_TIME : TIMEOUT), ok, probe })
    }
    if (Math.round(s.t * 20) % 5 === 0) s.hist = [...s.hist.slice(-120), { t: Math.round(s.t * 4) / 4, busy: s.busy.length }]
    render()
  }, TICK * 1000)

  const s = sim.current
  const remaining = s.state === 'OPEN' ? Math.max(0, openSecs - (s.t - s.openedAt)) : 0
  const nodes: { id: State; x: number; y: number; label: string; color: string }[] = [
    { id: 'CLOSED', x: 70, y: 70, label: 'CLOSED', color: colors.good },
    { id: 'OPEN', x: 330, y: 70, label: 'OPEN', color: colors.bad },
    { id: 'HALF_OPEN', x: 200, y: 190, label: 'HALF-OPEN', color: colors.warn },
  ]
  const lastT = s.transitions[0]
  const edgeActive = (a: State, b: State) => lastT && lastT.from === a && lastT.to === b && s.t - lastT.t < 1.2

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Recorre los tres estados" done={done}>
        Con el breaker activado, haz que pase por <b>CLOSED → OPEN → HALF-OPEN → CLOSED</b>: provoca una caída, espera y recupera el servicio. Progreso: <span className="font-mono text-text">{s.visited.slice(-4).join(' → ')}</span>
      </ChallengeBanner>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-3 bg-grid">
          <svg viewBox="0 0 400 250" className="w-full h-auto max-h-72">
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.muted} />
              </marker>
            </defs>
            {[
              ['CLOSED', 'OPEN', `fallos ≥ ${threshold}%`, 'M 120 60 L 280 60', 200, 50],
              ['OPEN', 'HALF_OPEN', `tras ${openSecs}s`, 'M 320 105 L 245 170', 305, 150],
              ['HALF_OPEN', 'CLOSED', '3 pruebas OK', 'M 155 170 L 85 105', 92, 150],
              ['HALF_OPEN', 'OPEN', 'prueba falla', 'M 250 185 Q 370 190 345 108', 352, 200],
            ].map(([a, b, label, d, lx, ly]) => (
              <g key={`${a}-${b}`}>
                <motion.path d={d as string} fill="none" stroke={edgeActive(a as State, b as State) ? colors.accent : colors.border} strokeWidth={edgeActive(a as State, b as State) ? 3.5 : 2} markerEnd="url(#arr)" animate={{ pathLength: 1 }} />
                <text x={lx as number} y={ly as number} textAnchor="middle" fontSize={10} fill={colors.muted}>{label as string}</text>
              </g>
            ))}
            {nodes.map((n) => {
              const active = s.state === n.id && enabled
              return (
                <g key={n.id}>
                  {active && <motion.circle cx={n.x} cy={n.y} r={46} fill={n.color} initial={{ opacity: 0.35, scale: 0.9 }} animate={{ opacity: [0.35, 0.1, 0.35], scale: [0.95, 1.1, 0.95] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ transformOrigin: `${n.x}px ${n.y}px` }} />}
                  <circle cx={n.x} cy={n.y} r={38} fill={colors.surface} stroke={n.color} strokeWidth={active ? 4 : 2} opacity={active || !enabled ? 1 : 0.55} />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill={active ? n.color : colors.muted}>{n.label}</text>
                  {n.id === 'OPEN' && active && <text x={n.x} y={n.y + 20} textAnchor="middle" fontSize={10} fill={colors.muted}>{remaining.toFixed(1)}s</text>}
                </g>
              )
            })}
            {!enabled && <text x={200} y={240} textAnchor="middle" fontSize={11} fill={colors.bad} fontWeight={700}>Breaker DESACTIVADO: todas las llamadas van al servicio</text>}
          </svg>
          <div className="mt-2">
            <div className="text-xs text-muted mb-1">Pool de hilos de tu app ({s.busy.length}/{THREADS} ocupados)</div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: THREADS }).map((_, i) => {
                const c = s.busy[i]
                return <div key={i} className="h-4 rounded" style={{ background: c ? (c.ok ? colors.accent : colors.bad) : colors.border, opacity: c ? 1 : 0.5 }} />
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-3 content-start">
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost !border-bad/50" onClick={() => setFailure(100)}>💥 Caída</button>
            <button className="btn btn-ghost !border-good/50" onClick={() => setFailure(0)}>🩹 Recuperar</button>
          </div>
          <Slider label="Tasa de fallo del servicio de pagos" min={0} max={100} step={5} value={failure} onChange={setFailure} format={(v) => `${v}%`} />
          <label className="text-xs flex items-center gap-2 text-muted">
            <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); sim.current.state = 'CLOSED'; sim.current.window = [] }} /> Circuit breaker activado
          </label>
          <Slider label="Umbral de apertura" min={20} max={100} step={10} value={threshold} onChange={setThreshold} format={(v) => `${v}% de 10`} />
          <Slider label="Tiempo en OPEN" min={1} max={15} value={openSecs} onChange={setOpenSecs} format={(v) => `${v} s`} />
          <p className="text-[11px] text-muted">Una llamada fallida no falla rápido: espera un timeout de {TIMEOUT}s ocupando un hilo. Sin breaker, una caída agota el pool y tu app deja de responder incluso en endpoints sanos.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Éxitos" value={s.counts.ok} color={colors.good} />
        <Stat label="Fallos (timeout)" value={s.counts.fail} color={colors.bad} />
        <Stat label="Fail fast / fallback" value={s.counts.fast} color={colors.warn} />
        <Stat label="Rechazadas (sin hilos)" value={s.counts.rejected} color={s.counts.rejected ? colors.bad : undefined} />
      </div>
      <div className="card p-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={s.hist} margin={{ left: -18, right: 8, top: 6, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <YAxis domain={[0, THREADS]} tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <Area type="stepAfter" dataKey="busy" name="hilos ocupados" stroke={colors.violet} fill={colors.violet} fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
