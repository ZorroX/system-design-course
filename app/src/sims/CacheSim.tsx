import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, ReferenceLine } from 'recharts'
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { ChallengeBanner, Segmented, Slider, Stat } from '@/components/ui'
import { useColors, useForceRender, useInterval } from '@/lib/hooks'
import { rng, zipf } from '@/lib/random'
import type { SimProps } from './index'

type Policy = 'LRU' | 'LFU' | 'FIFO' | 'RANDOM'
interface Slot { key: number; last: number; freq: number; ins: number }

const KEYS = 40
const TARGET = 0.52

export default function CacheSim({ done, onComplete }: SimProps) {
  const colors = useColors()
  const render = useForceRender()
  const [policy, setPolicy] = useState<Policy>('LRU')
  const [capacity, setCapacity] = useState(6)
  const [skew, setSkew] = useState(1.1)
  const [speed, setSpeed] = useState(8)
  const [running, setRunning] = useState(true)

  const rand = useMemo(() => rng(7), [])
  const sample = useMemo(() => zipf(KEYS, skew, rand), [skew, rand])

  const sim = useRef({ t: 0, slots: [] as Slot[], recent: [] as { key: number; hit: boolean; t: number }[], window: [] as boolean[], hist: [] as { t: number; rate: number }[], lastEvicted: null as number | null, flash: null as number | null })

  const step = () => {
    const s = sim.current
    s.t++
    const key = sample()
    const slot = s.slots.find((x) => x.key === key)
    s.lastEvicted = null
    if (slot) {
      slot.last = s.t
      slot.freq++
      s.flash = key
    } else {
      s.flash = null
      if (s.slots.length >= capacity) {
        let vi = 0
        if (policy === 'LRU') vi = s.slots.reduce((b, x, i) => (x.last < s.slots[b].last ? i : b), 0)
        if (policy === 'LFU') vi = s.slots.reduce((b, x, i) => (x.freq < s.slots[b].freq || (x.freq === s.slots[b].freq && x.last < s.slots[b].last) ? i : b), 0)
        if (policy === 'FIFO') vi = s.slots.reduce((b, x, i) => (x.ins < s.slots[b].ins ? i : b), 0)
        if (policy === 'RANDOM') vi = Math.floor(rand() * s.slots.length)
        s.lastEvicted = s.slots[vi].key
        s.slots.splice(vi, 1)
      }
      s.slots.push({ key, last: s.t, freq: 1, ins: s.t })
    }
    while (s.slots.length > capacity) s.slots.shift()
    s.recent = [{ key, hit: !!slot, t: s.t }, ...s.recent].slice(0, 24)
    s.window = [...s.window, !!slot].slice(-200)
    const rate = s.window.filter(Boolean).length / s.window.length
    if (s.t % 5 === 0) s.hist = [...s.hist.slice(-80), { t: s.t, rate: Math.round(rate * 100) }]
    if (!done && s.window.length >= 200 && rate >= TARGET && capacity <= 6 && skew <= 1.1) onComplete()
    render()
  }

  useInterval(step, 1000 / speed, running)

  const reset = () => {
    sim.current = { t: 0, slots: [], recent: [], window: [], hist: [], lastEvicted: null, flash: null }
    render()
  }

  const s = sim.current
  const hitRate = s.window.length ? s.window.filter(Boolean).length / s.window.length : 0
  const maxFreq = Math.max(1, ...s.slots.map((x) => x.freq))
  const ordered = [...s.slots].sort((a, b) => (policy === 'LFU' ? b.freq - a.freq : policy === 'FIFO' ? b.ins - a.ins : b.last - a.last))

  return (
    <div className="grid gap-4">
      <ChallengeBanner title={`hit rate ≥ ${TARGET * 100}% con poca memoria`} done={done}>
        Con <b>capacidad ≤ 6</b> y skew <b>≤ 1.1</b>, logra un hit rate ≥ {TARGET * 100}% en las últimas 200 peticiones. Pista: ¿qué política aprovecha mejor una popularidad estable?
      </ChallengeBanner>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-4 bg-grid">
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <span className="font-semibold">Stream de peticiones</span>
            <span className="ml-auto">verde = hit · rojo = miss → DB</span>
          </div>
          <div className="flex gap-1 overflow-hidden h-8 mb-5">
            <AnimatePresence initial={false}>
              {s.recent.map((r) => (
                <motion.div
                  key={r.t}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`shrink-0 w-8 h-8 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center ${r.hit ? 'bg-good/20 text-good border border-good/50' : 'bg-bad/15 text-bad border border-bad/40'}`}
                >
                  k{r.key}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <span className="font-semibold">⚡ Caché ({s.slots.length}/{capacity})</span>
            <span className="ml-auto">orden: {policy === 'LFU' ? 'más frecuente → menos' : policy === 'FIFO' ? 'más nuevo → más viejo' : 'más reciente → menos'}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 min-h-[5.5rem]">
            <AnimatePresence mode="popLayout">
              {ordered.map((slot) => (
                <motion.div
                  key={slot.key}
                  layout
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: s.flash === slot.key ? 1.08 : 1, y: 0, borderColor: s.flash === slot.key ? colors.good : colors.border }}
                  exit={{ opacity: 0, scale: 0.3, y: -30, rotate: -15 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="rounded-xl border-2 bg-surface-2 p-2 text-center"
                >
                  <div className="font-mono font-bold text-sm">key:{slot.key}</div>
                  <div className="h-1.5 rounded-full bg-border mt-1.5 overflow-hidden">
                    <div className="h-full bg-warn" style={{ width: `${(slot.freq / maxFreq) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-muted mt-1">freq {slot.freq} · hace {s.t - slot.last}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="h-5 mt-2 text-xs text-muted">
            {s.lastEvicted !== null && (
              <motion.span key={s.t} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                🗑️ Expulsada <span className="font-mono text-bad">key:{s.lastEvicted}</span> por {policy}
              </motion.span>
            )}
          </div>
        </div>

        <div className="grid gap-3 content-start">
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button className="btn btn-ghost flex-1" onClick={step} disabled={running} aria-label="Paso">
              <StepForward size={16} />
            </button>
            <button className="btn btn-ghost flex-1" onClick={reset} aria-label="Reiniciar">
              <RotateCcw size={16} />
            </button>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Política de expulsión</div>
            <Segmented size="sm" value={policy} onChange={setPolicy} options={(['LRU', 'LFU', 'FIFO', 'RANDOM'] as Policy[]).map((p) => ({ id: p, label: p }))} />
          </div>
          <Slider label="Capacidad" min={1} max={12} value={capacity} onChange={setCapacity} />
          <Slider label="Sesgo de popularidad (Zipf s)" min={0} max={2} step={0.1} value={skew} onChange={setSkew} format={(v) => v.toFixed(1)} />
          <Slider label="Velocidad" min={1} max={30} value={speed} onChange={setSpeed} format={(v) => `${v} req/s`} />
          <p className="text-[11px] text-muted">{KEYS} claves posibles. Con s=0 todas son igual de populares (la caché casi no sirve); con s alto unas pocas dominan.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Hit rate (200)" value={`${Math.round(hitRate * 100)}%`} color={hitRate >= TARGET ? colors.good : undefined} />
        <Stat label="Carga a la DB" value={`${Math.round((1 - hitRate) * 100)}%`} sub="de las lecturas" />
        <Stat label="Peticiones" value={s.t} />
      </div>
      <div className="card p-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={s.hist} margin={{ left: -18, right: 8, top: 6, bottom: 0 }}>
            <defs>
              <linearGradient id="hr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.good} stopOpacity={0.5} />
                <stop offset="100%" stopColor={colors.good} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: colors.muted }} stroke={colors.border} />
            <ReferenceLine y={TARGET * 100} stroke={colors.warn} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="rate" stroke={colors.good} fill="url(#hr)" strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
