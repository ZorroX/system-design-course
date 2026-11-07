import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { ESTIMATIONS, scoreEstimate, type EstimationProblem } from '@/data/estimations'
import { useGame } from '@/store/game'
import { Card, SectionTitle, Segmented } from '@/components/ui'
import { fmt, fmtBytes } from '@/lib/format'
import { blip, celebrate } from '@/lib/fx'

const UNITS: Record<EstimationProblem['unit'], { id: string; label: string; mult: number }[]> = {
  rps: [
    { id: '1', label: '/s', mult: 1 },
    { id: 'k', label: 'k/s', mult: 1e3 },
    { id: 'M', label: 'M/s', mult: 1e6 },
  ],
  bytes: [
    { id: 'GB', label: 'GB', mult: 1e9 },
    { id: 'TB', label: 'TB', mult: 1e12 },
    { id: 'PB', label: 'PB', mult: 1e15 },
  ],
  count: [{ id: '1', label: 'instancias', mult: 1 }],
  bps: [
    { id: 'K', label: 'Kbps', mult: 1e3 },
    { id: 'M', label: 'Mbps', mult: 1e6 },
    { id: 'G', label: 'Gbps', mult: 1e9 },
  ],
}

function show(v: number, unit: EstimationProblem['unit']) {
  if (unit === 'bytes') return fmtBytes(v)
  if (unit === 'bps') return `${fmt(v / 1e6)} Mbps`
  if (unit === 'rps') return `${fmt(v)}/s`
  return fmt(v)
}

const CHEAT = [
  ['1 día', '≈ 10⁵ s'],
  ['1 mes', '≈ 2,5 × 10⁶ s'],
  ['1 año', '≈ 3 × 10⁷ s'],
  ['1 M/día', '≈ 12/s'],
  ['KB → MB → GB → TB → PB', '× 1.000 cada paso'],
  ['1 Gbps', '≈ 125 MB/s'],
]

export default function Estimate() {
  const best = useGame((s) => s.estimations)
  const save = useGame((s) => s.saveEstimation)
  const [idx, setIdx] = useState(0)
  const p = ESTIMATIONS[idx]
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState(UNITS[p.unit][Math.min(1, UNITS[p.unit].length - 1)].id)
  const [result, setResult] = useState<{ score: number; guess: number } | null>(null)

  const select = (i: number) => {
    setIdx(i)
    const u = UNITS[ESTIMATIONS[i].unit]
    setUnit(u[Math.min(1, u.length - 1)].id)
    setValue('')
    setResult(null)
  }

  const submit = () => {
    const num = parseFloat(value.replace(',', '.'))
    if (!(num > 0)) return
    const guess = num * UNITS[p.unit].find((u) => u.id === unit)!.mult
    const score = scoreEstimate(guess, p.answer)
    setResult({ score, guess })
    save(p.id, score)
    blip(score >= 55 ? 'good' : 'bad')
    if (score >= 80) celebrate('small')
  }

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <SectionTitle sub="Estima en órdenes de magnitud. Puntuación: dentro de ±40% = 100, ±2× = 80, ±3× = 55, ±10× = 25.">🧮 Estimación back-of-the-envelope</SectionTitle>

      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
        {ESTIMATIONS.map((e, i) => (
          <button key={e.id} onClick={() => select(i)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${i === idx ? 'border-warn bg-warn/10' : 'border-border bg-surface hover:border-warn/50'}`}>
            <div className="font-bold">{e.title}</div>
            <div className="text-muted">{best[e.id] !== undefined ? `mejor: ${best[e.id]}` : 'sin intentar'}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_18rem] gap-6">
        <Card className="p-5 sm:p-6">
          <div className="text-xs font-bold uppercase tracking-wide text-warn mb-1">Problema {idx + 1}/{ESTIMATIONS.length}</div>
          <h2 className="text-xl font-bold mb-3">{p.prompt}</h2>
          <div className="grid gap-2 mb-5">
            {p.givens.map((g) => (
              <div key={g} className="rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm">
                📌 {g}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tu estimación"
              disabled={!!result}
              className="w-40 rounded-xl bg-surface-2 border border-border px-3 py-2 text-lg font-mono focus:outline-none focus:border-warn"
            />
            {UNITS[p.unit].length > 1 ? <Segmented value={unit} onChange={setUnit} options={UNITS[p.unit].map((u) => ({ id: u.id, label: u.label }))} /> : <span className="text-muted">{UNITS[p.unit][0].label}</span>}
            {!result && (
              <button className="btn btn-primary" onClick={submit} disabled={!value}>
                Estimar
              </button>
            )}
          </div>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid gap-4">
                <div className="flex items-center gap-5">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className={`text-5xl font-extrabold ${result.score >= 80 ? 'text-good' : result.score >= 55 ? 'text-warn' : 'text-bad'}`}>
                    {result.score}
                  </motion.div>
                  <div className="text-sm">
                    <div>
                      Tu estimación: <b className="font-mono">{show(result.guess, p.unit)}</b>
                    </div>
                    <div>
                      Referencia: <b className="font-mono text-accent">{show(p.answer, p.unit)}</b>
                    </div>
                    <div className="text-xs text-muted">Te desviaste {(result.guess / p.answer >= 1 ? result.guess / p.answer : p.answer / result.guess).toFixed(1)}×</div>
                  </div>
                </div>
                {/* escala logarítmica */}
                <div className="relative h-10">
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-surface-2 rounded" />
                  {[-1, -0.5, 0, 0.5, 1].map((d) => (
                    <div key={d} className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-border" style={{ left: `${50 + d * 45}%` }} />
                  ))}
                  <div className="absolute top-0 -translate-x-1/2 text-[10px] text-accent font-bold" style={{ left: '50%' }}>✓</div>
                  <motion.div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-warn border-2 border-bg" initial={{ left: '50%' }} animate={{ left: `${50 + Math.max(-1, Math.min(1, Math.log10(result.guess / p.answer))) * 45}%` }} transition={{ type: 'spring', stiffness: 80 }} />
                  <div className="absolute bottom-0 left-0 text-[10px] text-muted">÷10</div>
                  <div className="absolute bottom-0 right-0 text-[10px] text-muted">×10</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-muted mb-2">Cómo se calcula</div>
                  <ol className="grid gap-1.5">
                    {p.steps.map((s, i) => (
                      <motion.li key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.15 }} className="text-sm font-mono bg-surface-2 rounded-lg px-3 py-1.5">
                        {i + 1}. {s}
                      </motion.li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-xl border border-violet/40 bg-violet/10 px-4 py-3 text-sm">🎤 {p.takeaway}</div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost" onClick={() => select(idx)}>
                    Reintentar
                  </button>
                  {idx < ESTIMATIONS.length - 1 && (
                    <button className="btn btn-primary" onClick={() => select(idx + 1)}>
                      Siguiente →
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
        <Card className="p-5 content-start h-fit">
          <div className="font-bold mb-3">📒 Chuleta</div>
          <div className="grid gap-1.5 text-sm">
            {CHEAT.map(([a, b]) => (
              <div key={a} className="flex justify-between gap-3 border-b border-border pb-1.5 last:border-0">
                <span className="text-muted">{a}</span>
                <span className="font-mono font-semibold text-right">{b}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
