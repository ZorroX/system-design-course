import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Play } from 'lucide-react'
import { ChallengeBanner, Segmented, Stat } from '@/components/ui'
import { ForgeSim, POLICY_LABEL, QUEUE_STEPS, WORKLOADS, queueLabel, suggestedThreads, type Policy, type PoolConfig, type ForgeResult, type Sample } from '@/quest/models/forge'
import type { SimProps } from './index'

const THREADS = [1, 2, 4, 5, 6, 8, 10, 16, 20, 30, 40, 50, 64, 80, 100, 150, 200]

function Picker({ label, value, list, fmt, onChange }: { label: string; value: number; list: number[]; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  const i = list.indexOf(value)
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost !px-2.5 !py-1" onClick={() => onChange(list[Math.max(0, i - 1)])}>−</button>
        <span className="min-w-[7rem] text-center font-mono text-accent">{fmt ? fmt(value) : value}</span>
        <button className="btn btn-ghost !px-2.5 !py-1" onClick={() => onChange(list[Math.min(list.length - 1, i + 1)])}>+</button>
      </div>
    </label>
  )
}

export default function ThreadPoolSim({ done, onComplete }: SimProps) {
  const [wl, setWl] = useState<'io' | 'cpu'>('io')
  const [cfg, setCfg] = useState<PoolConfig>({ core: 4, max: 4, queue: Infinity, policy: 'abort' })
  const [res, setRes] = useState<{ r: ForgeResult; samples: Sample[]; wl: 'io' | 'cpu' } | null>(null)
  const [goals, setGoals] = useState({ oom: false, io: false, cpu: false })
  const w = WORKLOADS.find((x) => x.id === wl)!

  const run = () => {
    const sim = new ForgeSim({ ...cfg }, w, 7)
    while (!sim.finished) sim.step(0.05)
    const r = sim.result()
    setRes({ r, samples: sim.samples, wl })
    setGoals((g) => ({ oom: g.oom || r.oom, io: g.io || (wl === 'io' && r.stars >= 2), cpu: g.cpu || (wl === 'cpu' && r.stars === 3) }))
  }

  useEffect(() => {
    if (!done && goals.oom && goals.io && goals.cpu) onComplete()
  }, [goals, done, onComplete])

  const chart = useMemo(() => (res ? res.samples.filter((_, i) => i % 2 === 0) : []), [res])
  const set = (p: Partial<PoolConfig>) => setCfg((c) => {
    const n = { ...c, ...p }
    if (p.core !== undefined && n.max < n.core) n.max = n.core
    if (p.max !== undefined && n.core > n.max) n.core = n.max
    return n
  })

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Configura el ThreadPoolExecutor" done={done}>
        (1) Provoca un <b>OutOfMemoryError</b> con una cola sin límite {goals.oom ? '✅' : '⬜'} · (2) Supera el pico de <b>I/O</b> {goals.io ? '✅' : '⬜'} · (3) Supera el de <b>CPU</b> con 3★ (pocos hilos y cola acotada) {goals.cpu ? '✅' : '⬜'}
      </ChallengeBanner>
      <div className="grid lg:grid-cols-[19rem_1fr] gap-4">
        <div className="card p-4 grid gap-4 content-start">
          <Segmented options={[{ id: 'io', label: '🌐 I/O (adquirente)' }, { id: 'cpu', label: '🧮 CPU (antifraude)' }]} value={wl} onChange={(v) => { setWl(v); setRes(null) }} size="sm" />
          <p className="text-xs text-muted">{w.story}</p>
          <div className="text-xs rounded-lg bg-surface-2 p-2">
            Fórmula de Goetz: {w.cores} × (1 + {w.waitMs}/{w.cpuMs}) ≈ <b className="text-accent">{suggestedThreads(w)}</b> hilos · Meta: p99 ≤ {w.goal.p99} ms, rechazos ≤ {w.goal.rejectPct}%
          </div>
          <Picker label="corePoolSize" value={cfg.core} list={THREADS} onChange={(v) => set({ core: v })} />
          <Picker label="maximumPoolSize" value={cfg.max} list={THREADS} onChange={(v) => set({ max: v })} />
          <Picker label="Capacidad de la cola" value={cfg.queue} list={QUEUE_STEPS} fmt={queueLabel} onChange={(v) => set({ queue: v })} />
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Política de rechazo</span>
            <select className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm" value={cfg.policy} onChange={(e) => set({ policy: e.target.value as Policy })}>
              {(Object.keys(POLICY_LABEL) as Policy[]).map((p) => (
                <option key={p} value={p}>{POLICY_LABEL[p]}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={run}><Play size={16} /> Simular pico</button>
            <button className="btn btn-ghost text-xs" onClick={() => setCfg({ core: 4, max: 4, queue: Infinity, policy: 'abort' })}>newFixedThreadPool(4)</button>
          </div>
        </div>
        <div className="card p-4 grid gap-3 content-start">
          {!res ? (
            <div className="text-sm text-muted">Elige una configuración y simula 12 segundos de tráfico con un pico. Verás hilos, cola y memoria en el tiempo.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="p99" value={res.r.oom ? 'OOM' : `${res.r.p99} ms`} color={res.r.pass ? 'var(--good)' : 'var(--bad)'} />
                <Stat label="Rechazos" value={`${res.r.rejectPct.toFixed(1)}%`} />
                <Stat label="Pico de hilos" value={res.r.peakThreads} />
                <Stat label="Pico de heap" value={`${res.r.peakMem} MB`} sub={`de ${w.heapMb} MB`} />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tick={{ fontSize: 11, fill: 'var(--muted)' }} unit="s" />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="threads" name="hilos" stroke="#f97316" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="queue" name="cola" stroke="#fbbf24" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="memMb" name="heap MB" stroke="#34d399" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="doneRate" name="hechas/s" stroke="#22d3ee" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className={`rounded-xl border px-4 py-3 text-sm ${res.r.pass ? 'border-good/50 bg-good/10' : 'border-bad/50 bg-bad/10'}`}>
                <b>{res.r.pass ? `✅ ${'★'.repeat(res.r.stars)} ` : '❌ '}</b>
                {res.r.msg}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
