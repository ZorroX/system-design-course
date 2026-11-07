import { useEffect, useRef, useState } from 'react'
import { ChallengeBanner } from '@/components/ui'
import { INCIDENTS, towerStars, type Choice } from '@/quest/models/tower'
import type { SimProps } from './index'

interface Run {
  used: string[]
  restarted: boolean
  log: { cmd: string; out: string }[]
  step: 'investigate' | 'diagnosis' | 'fix' | 'done'
  wrong: number
  picked: number | null
}

const fresh = (): Run => ({ used: [], restarted: false, log: [], step: 'investigate', wrong: 0, picked: null })

export default function TerminalSim({ done, onComplete }: SimProps) {
  const [idx, setIdx] = useState(0)
  const [runs, setRuns] = useState<Run[]>(() => INCIDENTS.map(fresh))
  const [stars, setStars] = useState<Record<string, number>>({})
  const term = useRef<HTMLDivElement>(null)
  const inc = INCIDENTS[idx]
  const run = runs[idx]
  const update = (p: Partial<Run>) => setRuns((rs) => rs.map((r, i) => (i === idx ? { ...r, ...p } : r)))

  useEffect(() => {
    term.current?.scrollTo({ top: term.current.scrollHeight, behavior: 'smooth' })
  }, [run.log.length])

  useEffect(() => {
    if (!done && INCIDENTS.every((x) => (stars[x.id] ?? 0) > 0)) onComplete()
  }, [stars, done, onComplete])

  const exec = (id: string) => {
    const c = inc.commands.find((x) => x.id === id)!
    update({ used: run.used.includes(id) ? run.used : [...run.used, id], restarted: run.restarted || !!c.restart, log: [...run.log, { cmd: c.cmd, out: c.out }] })
  }

  const choose = (ch: Choice, i: number) => {
    if (run.picked !== null) return
    const ok = i === ch.answer
    update({ picked: i, wrong: run.wrong + (ok ? 0 : 1) })
  }

  const next = () => {
    const ch = run.step === 'diagnosis' ? inc.diagnosis : inc.fix
    if (run.picked !== ch.answer) return update({ picked: null })
    if (run.step === 'diagnosis') return update({ step: 'fix', picked: null })
    const s = Math.max(1, towerStars(run.used.length, inc.optimal, run.restarted) - run.wrong)
    setStars((st) => ({ ...st, [inc.id]: Math.max(st[inc.id] ?? 0, s) }))
    update({ step: 'done', picked: null })
  }

  const ch = run.step === 'diagnosis' ? inc.diagnosis : run.step === 'fix' ? inc.fix : null
  const s = stars[inc.id] ?? 0

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Resuelve los 4 incidentes de la guardia" done={done}>
        {INCIDENTS.map((x) => `${x.icon} ${x.title} ${(stars[x.id] ?? 0) > 0 ? '★'.repeat(stars[x.id]) : '⬜'}`).join(' · ')}. 3★ con pocos comandos y sin reiniciar antes de capturar evidencia.
      </ChallengeBanner>
      <div className="flex flex-wrap gap-2">
        {INCIDENTS.map((x, i) => (
          <button key={x.id} onClick={() => setIdx(i)} className={`chip ${i === idx ? '!border-accent !text-accent' : ''}`}>
            {x.icon} {x.title} {(stars[x.id] ?? 0) > 0 && '✓'}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-bad/50 bg-bad/10 px-4 py-2 text-sm font-semibold">{inc.alert}</div>
      <div className="grid lg:grid-cols-[18rem_1fr] gap-4">
        <div className="card p-3 grid gap-2 content-start">
          <div className="text-xs text-muted">Comandos usados: {run.used.length} {run.restarted && '· ⚠️ reiniciaste'}</div>
          {inc.commands.map((c) => {
            const locked = (c.requires ?? []).some((r) => !run.used.includes(r))
            return (
              <button key={c.id} disabled={locked || run.step === 'done'} title={locked ? 'Necesitas datos de otro comando primero' : c.hint} onClick={() => exec(c.id)} className={`text-left rounded-lg border px-2.5 py-1.5 font-mono text-[11px] leading-snug transition-colors ${c.restart ? 'border-bad/40' : 'border-border'} ${locked ? 'opacity-40 cursor-not-allowed' : 'hover:border-accent'} ${run.used.includes(c.id) ? 'bg-accent/10' : 'bg-surface-2'}`}>
                {run.used.includes(c.id) ? '✓ ' : '$ '}
                {c.cmd}
              </button>
            )
          })}
          {run.step === 'investigate' && (
            <button className="btn btn-primary mt-1" onClick={() => update({ step: 'diagnosis' })}>🩺 Diagnosticar</button>
          )}
          {run.step === 'done' && (
            <button className="btn btn-ghost mt-1" onClick={() => setRuns((rs) => rs.map((r, i) => (i === idx ? fresh() : r)))}>↺ Repetir incidente</button>
          )}
        </div>
        <div className="grid gap-3 content-start">
          <div ref={term} className="rounded-xl bg-[#05070f] border border-[#1f2a4a] p-3 font-mono text-[11.5px] leading-relaxed text-[#a7f3d0] h-80 overflow-auto whitespace-pre-wrap">
            {run.log.length === 0 ? 'app@pay-api-3:~$ _\n\nElige un comando a la izquierda (pasa el cursor para ver para qué sirve).' : run.log.map((l, i) => (
              <div key={i} className="mb-3">
                <span className="text-[#7dd3fc]">app@pay-api-3:~$ </span>
                {l.cmd}
                {'\n'}
                <span className="text-[#d1fae5]">{l.out}</span>
              </div>
            ))}
          </div>
          {ch && (
            <div className="card p-4 grid gap-2">
              <div className="font-bold">{ch.q}</div>
              {ch.options.map((o, i) => (
                <button key={i} onClick={() => choose(ch, i)} className={`text-left text-sm rounded-lg border px-3 py-2 ${run.picked === null ? 'border-border hover:border-accent' : i === ch.answer && run.picked === i ? 'border-good bg-good/10' : i === run.picked ? 'border-bad bg-bad/10' : 'border-border opacity-60'}`}>
                  {o}
                </button>
              ))}
              {run.picked !== null && (
                <>
                  <div className="text-sm text-muted">{run.picked === ch.answer ? '✅ ' : '❌ '}{ch.explain}</div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={next}>{run.picked === ch.answer ? 'Continuar' : 'Reintentar'}</button>
                    {run.picked !== ch.answer && <button className="btn btn-ghost" onClick={() => update({ step: 'investigate', picked: null })}>Investigar más</button>}
                  </div>
                </>
              )}
            </div>
          )}
          {run.step === 'done' && (
            <div className="rounded-xl border border-good/50 bg-good/10 px-4 py-3 text-sm">
              <b>✅ {'★'.repeat(s)}{'☆'.repeat(3 - s)} Resuelto con {run.used.length} comandos.</b> {inc.lesson}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
