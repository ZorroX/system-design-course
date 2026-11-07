import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Minus, Plus, Zap } from 'lucide-react'
import { ChallengeBanner, Slider, Stat } from '@/components/ui'
import { useColors, useForceRender, useInterval } from '@/lib/hooks'
import { poisson } from '@/lib/random'
import type { SimProps } from './index'

const TICK = 0.1
const SPIKE = 500

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <button className="btn btn-ghost !p-1.5" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Menos ${label}`}><Minus size={14} /></button>
        <span className="w-6 text-center font-mono text-sm">{value}</span>
        <button className="btn btn-ghost !p-1.5" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Más ${label}`}><Plus size={14} /></button>
      </span>
    </div>
  )
}

export default function QueueSim({ done, onComplete }: SimProps) {
  const colors = useColors()
  const render = useForceRender()
  const [partitions, setPartitions] = useState(3)
  const [consumers, setConsumers] = useState(2)
  const [rate, setRate] = useState(20)
  const [procMs, setProcMs] = useState(100)
  const [poison, setPoison] = useState(0)

  const sim = useRef({
    t: 0,
    lanes: Array.from({ length: 8 }, () => [] as { poison: boolean; tries: number }[]),
    acc: Array.from({ length: 10 }, () => 0),
    processed: 0,
    dlq: 0,
    hist: [] as { t: number; lag: number }[],
    spikeAt: null as number | null,
    drainTime: null as number | null,
  })

  // asignación partición -> consumidor (round robin)
  const assignment = Array.from({ length: partitions }, (_, p) => p % consumers)
  const idle = Math.max(0, consumers - partitions)

  useInterval(() => {
    const s = sim.current
    s.t = +(s.t + TICK).toFixed(2)
    const n = poisson(rate * TICK)
    for (let i = 0; i < n; i++) {
      const p = Math.floor(Math.random() * partitions)
      s.lanes[p].push({ poison: Math.random() * 100 < poison, tries: 0 })
    }
    // cada consumidor procesa sus particiones
    const perConsumer = (1000 / procMs) * TICK
    for (let c = 0; c < consumers; c++) {
      const mine = assignment.map((a, p) => (a === c ? p : -1)).filter((p) => p >= 0)
      if (!mine.length) continue
      s.acc[c] += perConsumer
      let guard = 0
      while (s.acc[c] >= 1 && guard++ < 200) {
        const lane = mine.reduce((best, p) => (s.lanes[p].length > s.lanes[best].length ? p : best), mine[0])
        const msg = s.lanes[lane][0]
        if (!msg) {
          s.acc[c] = Math.min(s.acc[c], 1)
          break
        }
        s.acc[c] -= 1
        if (msg.poison) {
          msg.tries++
          if (msg.tries >= 3) {
            s.lanes[lane].shift()
            s.dlq++
          }
        } else {
          s.lanes[lane].shift()
          s.processed++
        }
      }
    }
    const lag = s.lanes.slice(0, partitions).reduce((a, l) => a + l.length, 0)
    if (Math.round(s.t * 10) % 5 === 0) s.hist = [...s.hist.slice(-100), { t: Math.round(s.t), lag }]
    if (s.spikeAt !== null && s.drainTime === null && lag < 20) {
      s.drainTime = s.t - s.spikeAt
      if (!done && s.drainTime <= 15) onComplete()
    }
    render()
  }, TICK * 1000)

  const spike = () => {
    const s = sim.current
    for (let i = 0; i < SPIKE; i++) s.lanes[Math.floor(Math.random() * partitions)].push({ poison: false, tries: 0 })
    s.spikeAt = s.t
    s.drainTime = null
    render()
  }

  const changePartitions = (v: number) => {
    // al reducir particiones, los mensajes se redistribuyen (simplificación)
    const s = sim.current
    const all = s.lanes.flat()
    s.lanes = Array.from({ length: 8 }, () => [])
    all.forEach((m, i) => s.lanes[i % v].push(m))
    setPartitions(v)
  }

  const s = sim.current
  const lag = s.lanes.slice(0, partitions).reduce((a, l) => a + l.length, 0)
  const throughput = Math.min(consumers, partitions) * (1000 / procMs)
  const elapsed = s.spikeAt !== null ? (s.drainTime ?? s.t - s.spikeAt) : null

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Drena el pico" done={done}>
        Pulsa <b>Pico de {SPIKE}</b> y consigue que el lag baje de 20 en <b>≤ 15 s</b> (con {rate} msg/s de tráfico normal). ¿Basta con agregar consumidores?
        {elapsed !== null && (
          <span className="ml-1 font-mono text-text">
            {s.drainTime !== null ? `drenado en ${s.drainTime.toFixed(1)} s` : `⏱ ${elapsed.toFixed(1)} s`}
          </span>
        )}
      </ChallengeBanner>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-3 bg-grid overflow-hidden">
          <div className="grid grid-cols-[3.5rem_1fr_5.5rem] gap-2 items-center">
            <div className="text-center text-xs text-muted">
              <div className="text-2xl">🏭</div>
              {rate}/s
            </div>
            <div className="grid gap-1.5">
              {Array.from({ length: partitions }).map((_, p) => {
                const len = s.lanes[p].length
                return (
                  <div key={p} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted w-6">P{p}</span>
                    <div className="flex-1 h-6 rounded-md bg-surface-2 border border-border flex flex-row-reverse items-center gap-px px-1 overflow-hidden">
                      {s.lanes[p].slice(0, 60).map((m, i) => (
                        <div key={i} className="shrink-0 w-1.5 h-4 rounded-sm" style={{ background: m.poison ? colors.bad : len > 100 ? colors.warn : colors.accent }} />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono w-8 text-right">{len}</span>
                  </div>
                )
              })}
            </div>
            <div className="grid gap-1">
              {Array.from({ length: consumers }).map((_, c) => {
                const mine = assignment.map((a, p) => (a === c ? p : -1)).filter((p) => p >= 0)
                return (
                  <motion.div layout key={c} className={`rounded-md border px-1.5 py-1 text-[10px] font-mono ${mine.length ? 'border-good/60 bg-good/10' : 'border-border text-muted opacity-60'}`}>
                    ⚙️ C{c} {mine.length ? `← P${mine.join(',P')}` : 'ocioso'}
                  </motion.div>
                )
              })}
            </div>
          </div>
          <div className="text-[11px] text-muted mt-3">
            Cada partición la consume un único consumidor del grupo. Paralelismo efectivo = min(consumidores, particiones) = <b className="text-text">{Math.min(consumers, partitions)}</b>
            {idle > 0 && <span className="text-warn"> · {idle} consumidor(es) ocioso(s)</span>}
          </div>
        </div>

        <div className="grid gap-3 content-start">
          <Stepper label="Particiones" value={partitions} min={1} max={8} onChange={changePartitions} />
          <Stepper label="Consumidores" value={consumers} min={1} max={10} onChange={setConsumers} />
          <Slider label="Productores" min={1} max={80} value={rate} onChange={setRate} format={(v) => `${v} msg/s`} />
          <Slider label="Tiempo de proceso" min={50} max={500} step={25} value={procMs} onChange={setProcMs} format={(v) => `${v} ms/msg`} />
          <Slider label="Mensajes venenosos" min={0} max={20} value={poison} onChange={setPoison} format={(v) => `${v}%`} />
          <button className="btn btn-primary" onClick={spike}>
            <Zap size={16} /> Pico de {SPIKE}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Lag" value={lag} color={lag > 100 ? colors.bad : lag > 20 ? colors.warn : colors.good} />
        <Stat label="Capacidad" value={`${throughput.toFixed(0)}/s`} sub={throughput < rate ? '¡menor que la entrada!' : 'msgs procesables'} color={throughput < rate ? colors.bad : undefined} />
        <Stat label="Procesados" value={s.processed} />
        <Stat label="DLQ" value={s.dlq} sub="tras 3 reintentos" color={s.dlq ? colors.warn : undefined} />
      </div>
      <div className="card p-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={s.hist} margin={{ left: -18, right: 8, top: 6, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <YAxis tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <Tooltip contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="lag" name="consumer lag" stroke={colors.pink} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
