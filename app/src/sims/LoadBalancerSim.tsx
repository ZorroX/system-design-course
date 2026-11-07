import { useRef, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Minus, Pause, Play, Plus } from 'lucide-react'
import { ChallengeBanner, Segmented, Slider, Stat } from '@/components/ui'
import { useColors, useForceRender, useInterval } from '@/lib/hooks'
import { poisson } from '@/lib/random'
import type { SimProps } from './index'

type Algo = 'rr' | 'lc' | 'random' | 'p2c'
interface Req { id: number; server: number; born: number; start?: number; dur: number; slow: boolean }
interface Server { id: number; alive: boolean; active: Req[]; queue: Req[]; served: number }

const CAP = 4 // peticiones concurrentes por servidor
const QUEUE = 4 // cola máxima por servidor
const TICK = 0.05 // segundos simulados por tick
const FAST = 0.2
const SLOW = 2.5

export default function LoadBalancerSim({ done, onComplete }: SimProps) {
  const colors = useColors()
  const render = useForceRender()
  const [algo, setAlgo] = useState<Algo>('rr')
  const [rate, setRate] = useState(12)
  const [slowPct, setSlowPct] = useState(10)
  const [health, setHealth] = useState(true)
  const [running, setRunning] = useState(true)

  const sim = useRef({
    t: 0,
    nextId: 1,
    rr: 0,
    servers: [0, 1, 2].map((id) => ({ id, alive: true, active: [], queue: [], served: 0 })) as Server[],
    flying: [] as { id: number; server: number; t: number; ok: boolean }[],
    lat: [] as { t: number; v: number }[],
    errors: [] as number[],
    history: [] as { t: number; p95: number; err: number }[],
    cleanSince: 0,
  })

  const pick = (servers: Server[]): Server | undefined => {
    const pool = health ? servers.filter((s) => s.alive) : servers
    if (!pool.length) return undefined
    const load = (s: Server) => s.active.length + s.queue.length
    switch (algo) {
      case 'rr':
        return pool[sim.current.rr++ % pool.length]
      case 'random':
        return pool[Math.floor(Math.random() * pool.length)]
      case 'lc':
        return pool.reduce((a, b) => (load(b) < load(a) ? b : a))
      case 'p2c': {
        const a = pool[Math.floor(Math.random() * pool.length)]
        const b = pool[Math.floor(Math.random() * pool.length)]
        return load(a) <= load(b) ? a : b
      }
    }
  }

  useInterval(
    () => {
      const s = sim.current
      s.t += TICK
      // llegadas
      const n = poisson(rate * TICK)
      for (let i = 0; i < n; i++) {
        const slow = Math.random() * 100 < slowPct
        const srv = pick(s.servers)
        const id = s.nextId++
        if (!srv) {
          s.errors.push(s.t)
          continue
        }
        s.flying.push({ id, server: srv.id, t: s.t, ok: true })
        const req: Req = { id, server: srv.id, born: s.t, dur: slow ? SLOW : FAST, slow }
        if (!srv.alive) {
          s.errors.push(s.t) // sin health checks: el LB manda tráfico a un muerto
          s.flying[s.flying.length - 1].ok = false
        } else if (srv.active.length < CAP) {
          req.start = s.t
          srv.active.push(req)
        } else if (srv.queue.length < QUEUE) srv.queue.push(req)
        else {
          s.errors.push(s.t) // 503: cola llena
          s.flying[s.flying.length - 1].ok = false
        }
      }
      // procesamiento
      for (const srv of s.servers) {
        const still: Req[] = []
        for (const r of srv.active) {
          if (s.t - (r.start ?? s.t) >= r.dur) {
            srv.served++
            s.lat.push({ t: s.t, v: s.t - r.born })
          } else still.push(r)
        }
        srv.active = still
        while (srv.alive && srv.active.length < CAP && srv.queue.length) {
          const r = srv.queue.shift()!
          r.start = s.t
          srv.active.push(r)
        }
      }
      s.flying = s.flying.filter((f) => s.t - f.t < 0.45)
      s.lat = s.lat.filter((l) => s.t - l.t < 5)
      s.errors = s.errors.filter((e) => s.t - e < 5)
      // historial por segundo
      if (Math.floor(s.t / 1) !== Math.floor((s.t - TICK) / 1)) {
        const sorted = s.lat.map((l) => l.v).sort((a, b) => a - b)
        const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0
        const err = s.errors.filter((e) => s.t - e < 1).length
        s.history = [...s.history.slice(-40), { t: Math.round(s.t), p95: Math.round(p95 * 1000), err }]
        // reto: 10 s sin errores con rate >= 20 y slow >= 25
        if (err > 0 || rate < 20 || slowPct < 25) s.cleanSince = s.t
        if (!done && s.t - s.cleanSince >= 10) onComplete()
      }
      render()
    },
    TICK * 1000,
    running,
  )

  const s = sim.current
  const sorted = s.lat.map((l) => l.v).sort((a, b) => a - b)
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0
  const errRate = s.errors.length / 5
  const H = 70 + s.servers.length * 62
  const yOf = (i: number) => 50 + i * 62
  const lbY = H / 2

  const setServers = (delta: number) => {
    const list = s.servers
    if (delta > 0 && list.length < 6) list.push({ id: Math.max(...list.map((x) => x.id)) + 1, alive: true, active: [], queue: [], served: 0 })
    if (delta < 0 && list.length > 1) list.pop()
    render()
  }
  const toggle = (id: number) => {
    const srv = s.servers.find((x) => x.id === id)!
    srv.alive = !srv.alive
    if (!srv.alive) {
      s.errors.push(...srv.active.map(() => s.t), ...srv.queue.map(() => s.t))
      srv.active = []
      srv.queue = []
    }
    render()
  }
  const cleanFor = Math.max(0, s.t - s.cleanSince)

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="10 segundos sin errores" done={done}>
        Sube el tráfico a <b>≥ 20 req/s</b> con <b>≥ 25% de peticiones lentas</b> y aguanta 10 s sin ningún error.
        {!done && rate >= 20 && slowPct >= 25 && <span className="ml-1 font-mono text-text">⏱ {cleanFor.toFixed(0)}/10 s</span>}
      </ChallengeBanner>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-2 bg-grid overflow-hidden">
          <svg viewBox={`0 0 600 ${H}`} className="w-full h-auto select-none">
            {/* clientes */}
            <g>
              <text x={40} y={lbY - 34} textAnchor="middle" fontSize={11} fill={colors.muted}>Clientes</text>
              <text x={40} y={lbY + 8} textAnchor="middle" fontSize={28}>👥</text>
            </g>
            <line x1={70} y1={lbY} x2={170} y2={lbY} stroke={colors.border} strokeWidth={2} className="flow-dash" />
            {/* LB */}
            <rect x={170} y={lbY - 26} width={90} height={52} rx={12} fill={colors.surface} stroke={colors.violet} strokeWidth={2} />
            <text x={215} y={lbY - 2} textAnchor="middle" fontSize={18}>⚖️</text>
            <text x={215} y={lbY + 16} textAnchor="middle" fontSize={10} fill={colors.text} fontWeight={600}>{algo.toUpperCase()}</text>
            {/* enlaces */}
            {s.servers.map((srv, i) => (
              <line key={srv.id} x1={260} y1={lbY} x2={420} y2={yOf(i)} stroke={srv.alive ? colors.border : colors.bad} strokeDasharray={srv.alive ? undefined : '4 4'} strokeWidth={1.5} />
            ))}
            {/* paquetes en vuelo */}
            {s.flying.map((f) => {
              const i = s.servers.findIndex((x) => x.id === f.server)
              if (i < 0) return null
              const p = Math.min(1, (s.t - f.t) / 0.4)
              const x = 260 + (420 - 260) * p
              const y = lbY + (yOf(i) - lbY) * p
              return <circle key={f.id} cx={x} cy={y} r={4} fill={f.ok ? colors.accent : colors.bad} />
            })}
            {/* servidores */}
            {s.servers.map((srv, i) => {
              const load = srv.active.length / CAP
              const col = !srv.alive ? colors.muted : load >= 1 && srv.queue.length >= QUEUE ? colors.bad : load >= 0.75 ? colors.warn : colors.good
              return (
                <g key={srv.id} onClick={() => toggle(srv.id)} className="cursor-pointer">
                  <rect x={420} y={yOf(i) - 24} width={160} height={48} rx={10} fill={colors.surface} stroke={col} strokeWidth={2} opacity={srv.alive ? 1 : 0.5} />
                  <text x={436} y={yOf(i) - 5} fontSize={11} fill={colors.text} fontWeight={700}>
                    {srv.alive ? '🖥️' : '💀'} srv-{srv.id + 1}
                  </text>
                  <text x={436} y={yOf(i) + 13} fontSize={9} fill={colors.muted}>
                    {srv.alive ? `servidas ${srv.served} · cola ${srv.queue.length}` : 'CAÍDO (clic: revivir)'}
                  </text>
                  {Array.from({ length: CAP }).map((_, k) => (
                    <rect key={k} x={530 + (k % 2) * 20} y={yOf(i) - 17 + Math.floor(k / 2) * 18} width={16} height={14} rx={3} fill={k < srv.active.length ? (srv.active[k].slow ? colors.warn : colors.accent) : colors.border} opacity={srv.alive ? 1 : 0.3} />
                  ))}
                </g>
              )
            })}
          </svg>
          <div className="text-[11px] text-muted px-2 pb-1">Clic en un servidor para tumbarlo/revivirlo. Celdas = slots de concurrencia ({CAP}); amarillo = petición lenta.</div>
        </div>

        <div className="grid gap-3 content-start">
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={16} /> : <Play size={16} />} {running ? 'Pausa' : 'Seguir'}
            </button>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Algoritmo</div>
            <Segmented size="sm" value={algo} onChange={setAlgo} options={[{ id: 'rr', label: 'Round robin' }, { id: 'lc', label: 'Least conn' }, { id: 'p2c', label: 'P2C' }, { id: 'random', label: 'Random' }]} />
          </div>
          <Slider label="Tráfico" min={2} max={40} value={rate} onChange={setRate} format={(v) => `${v} req/s`} />
          <Slider label="Peticiones lentas" min={0} max={60} step={5} value={slowPct} onChange={setSlowPct} format={(v) => `${v}%`} />
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-muted text-xs">Servidores: {s.servers.length}</span>
            <span className="flex gap-1">
              <button className="btn btn-ghost !p-1.5" onClick={() => setServers(-1)} aria-label="Quitar servidor"><Minus size={14} /></button>
              <button className="btn btn-ghost !p-1.5" onClick={() => setServers(1)} aria-label="Agregar servidor"><Plus size={14} /></button>
            </span>
          </div>
          <label className="text-xs flex items-center gap-2 text-muted">
            <input type="checkbox" checked={health} onChange={(e) => setHealth(e.target.checked)} /> Health checks activos
          </label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="p95 latencia" value={`${Math.round(p95 * 1000)} ms`} color={p95 > 2 ? colors.bad : undefined} />
        <Stat label="Errores/s" value={errRate.toFixed(1)} color={errRate > 0 ? colors.bad : colors.good} />
        <Stat label="Servidas" value={s.servers.reduce((a, b) => a + b.served, 0)} />
      </div>
      <div className="card p-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={s.history} margin={{ left: -18, right: 8, top: 6, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <YAxis yAxisId="l" tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <Tooltip contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12 }} />
            <Line yAxisId="l" type="monotone" dataKey="p95" name="p95 (ms)" stroke={colors.accent} dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line yAxisId="r" type="stepAfter" dataKey="err" name="errores/s" stroke={colors.bad} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
