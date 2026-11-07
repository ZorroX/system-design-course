import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, Pause, Play } from 'lucide-react'
import { CASES, type CaseStudy } from '@/data/cases'
import { useGame } from '@/store/game'
import { useInterval } from '@/lib/hooks'
import { Card, Empty, ProgressBar } from '@/components/ui'
import { celebrate } from '@/lib/fx'
import { FRAMEWORK } from './InterviewList'

interface Phase {
  id: string
  title: string
  minutes: number
  prompt: string
  expected: string[]
}

function phasesFor(c: CaseStudy): Phase[] {
  return [
    { id: 'req', title: 'Requisitos', minutes: 5, prompt: '¿Qué preguntas le harías al entrevistador? Lista requisitos funcionales y no funcionales.', expected: [...c.functional, ...c.nonFunctional] },
    { id: 'est', title: 'Estimación', minutes: 5, prompt: 'Estima tráfico, almacenamiento y lo que importe para este sistema.', expected: c.estimation.map((e) => `${e.label}: ${e.value}`) },
    { id: 'api', title: 'API', minutes: 5, prompt: 'Define los endpoints principales.', expected: c.api.map((a) => `${a.method} ${a.path}`) },
    { id: 'data', title: 'Modelo de datos', minutes: 5, prompt: 'Entidades, claves de acceso y almacenamiento elegido.', expected: c.dataModel.map((d) => `${d.entity} → ${d.store}`) },
    { id: 'hld', title: 'Diseño de alto nivel', minutes: 10, prompt: 'Describe los componentes y recorre un flujo de lectura y uno de escritura.', expected: c.diagram.nodes.filter((n) => n.kind !== 'client').map((n) => n.label) },
    { id: 'deep', title: 'Deep dive', minutes: 10, prompt: 'Profundiza en los componentes más críticos.', expected: c.deepDives.map((d) => d.title) },
    { id: 'wrap', title: 'Trade-offs y cierre', minutes: 5, prompt: 'Justifica decisiones, cuellos de botella y fallos.', expected: c.tradeoffs.map((t) => `${t.decision}: ${t.choice}`) },
  ]
}

function fmtClock(s: number) {
  const neg = s < 0
  const a = Math.abs(Math.round(s))
  return `${neg ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`
}

function Mock({ c }: { c: CaseStudy }) {
  const phases = useMemo(() => phasesFor(c), [c])
  const save = useGame((s) => s.saveInterview)
  const [stage, setStage] = useState<'intro' | 'run' | 'eval' | 'done'>('intro')
  const [i, setI] = useState(0)
  const [running, setRunning] = useState(true)
  const [elapsed, setElapsed] = useState<number[]>(phases.map(() => 0))
  const [notes, setNotes] = useState<string[]>(phases.map(() => ''))
  const [peeked, setPeeked] = useState<Set<number>>(new Set())
  const [followUp, setFollowUp] = useState<{ q: string; a: string; shown: boolean } | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [final, setFinal] = useState<{ score: number; byPhase: Record<string, number> } | null>(null)

  useInterval(
    () => {
      setElapsed((e) => e.map((v, k) => (k === i ? v + 1 : v)))
      // a mitad del deep dive, el entrevistador interrumpe con una pregunta
      if (phases[i].id === 'deep' && elapsed[i] === 90 && !followUp) {
        const f = c.followUps[Math.floor(Math.random() * c.followUps.length)]
        setFollowUp({ ...f, shown: false })
      }
    },
    1000,
    stage === 'run' && running,
  )

  const total = elapsed.reduce((a, b) => a + b, 0)
  const phase = phases[i]
  const remaining = phase.minutes * 60 - elapsed[i]

  const finishEval = () => {
    const byPhase: Record<string, number> = {}
    let got = 0
    let all = 0
    phases.forEach((p, k) => {
      const n = p.expected.filter((_, j) => checked[`${k}-${j}`]).length
      byPhase[p.id] = Math.round((n / p.expected.length) * 100)
      got += n
      all += p.expected.length
    })
    const timePenalty = total > 50 * 60 ? 5 : 0
    const score = Math.max(0, Math.round((got / all) * 100) - peeked.size * 4 - timePenalty)
    setFinal({ score, byPhase })
    save({ id: crypto.randomUUID?.() ?? String(Date.now()), caseId: c.id, date: Date.now(), score, byPhase, hints: peeked.size, minutes: Math.round(total / 60) })
    if (score >= 70) celebrate(score >= 80 ? 'big' : 'small')
    setStage('done')
  }

  if (stage === 'intro')
    return (
      <Card className="p-6 max-w-2xl">
        <div className="text-5xl mb-3">{c.emoji}</div>
        <h1 className="text-2xl font-extrabold mb-1">Entrevista simulada: {c.title}</h1>
        <p className="text-muted mb-4">"{c.prompt}"</p>
        <ul className="text-sm space-y-1.5 mb-5">
          <li>⏱ 7 fases, 45 minutos en total. El reloj de cada fase te avisa si te pasas.</li>
          <li>📝 Escribe tus respuestas como si hablaras en voz alta (o usa papel y solo marca la fase).</li>
          <li>👀 Puedes mirar lo que espera el entrevistador en cada fase, pero cuesta −4 puntos.</li>
          <li>🎤 En el deep dive el entrevistador te interrumpirá con una pregunta.</li>
          <li>✅ Al final te autoevalúas contra la rúbrica. Sé honesto: es tu práctica.</li>
        </ul>
        <button className="btn btn-primary" onClick={() => setStage('run')}>
          <Play size={16} /> Empezar
        </button>
      </Card>
    )

  if (stage === 'eval')
    return (
      <div className="grid gap-4 max-w-3xl">
        <div>
          <h1 className="text-2xl font-extrabold">Autoevaluación</h1>
          <p className="text-sm text-muted">Marca lo que realmente cubriste. Tus notas están a la izquierda de cada fase como referencia.</p>
        </div>
        {phases.map((p, k) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold">
                {k + 1}. {p.title}
              </div>
              <span className="text-xs text-muted font-mono">{fmtClock(elapsed[k])} / {p.minutes}:00</span>
            </div>
            {notes[k] && <div className="text-xs text-muted whitespace-pre-wrap bg-surface-2 rounded-lg p-2 mb-2 max-h-32 overflow-auto">{notes[k]}</div>}
            <div className="grid gap-1.5">
              {p.expected.map((e, j) => {
                const key = `${k}-${j}`
                return (
                  <label key={key} className={`flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 cursor-pointer border ${checked[key] ? 'border-good/40 bg-good/10' : 'border-transparent hover:bg-surface-2'}`}>
                    <input type="checkbox" className="mt-1" checked={!!checked[key]} onChange={(ev) => setChecked((c2) => ({ ...c2, [key]: ev.target.checked }))} />
                    {e}
                  </label>
                )
              })}
            </div>
          </Card>
        ))}
        <button className="btn btn-primary" onClick={finishEval}>
          Calcular puntuación
        </button>
      </div>
    )

  if (stage === 'done' && final)
    return (
      <Card className="p-6 max-w-2xl text-center">
        <div className="text-6xl mb-2">{final.score >= 80 ? '💼' : final.score >= 60 ? '👍' : '📚'}</div>
        <div className="text-4xl font-extrabold">{final.score}%</div>
        <div className="text-muted mb-1">{final.score >= 80 ? 'Nivel de oferta. ¡Excelente!' : final.score >= 60 ? 'Buen camino: refuerza las fases más flojas.' : 'Repasa el caso y vuelve a intentarlo.'}</div>
        <div className="text-xs text-muted mb-5">
          {Math.round(total / 60)} min · {peeked.size} pista(s) usada(s)
        </div>
        <div className="grid gap-2 text-left">
          {phases.map((p) => (
            <div key={p.id} className="flex items-center gap-3 text-xs">
              <span className="w-36 text-muted truncate">{p.title}</span>
              <ProgressBar value={final.byPhase[p.id] / 100} color={final.byPhase[p.id] >= 70 ? 'var(--good)' : final.byPhase[p.id] >= 40 ? 'var(--warn)' : 'var(--bad)'} />
              <span className="w-10 text-right tabular-nums">{final.byPhase[p.id]}%</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          <Link to={`/interview/${c.id}`} className="btn btn-ghost">Ver solución completa</Link>
          <Link to="/interview" className="btn btn-primary">Otro caso</Link>
        </div>
      </Card>
    )

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      {/* Stepper */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {phases.map((p, k) => (
          <button key={p.id} onClick={() => setI(k)} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold border ${k === i ? 'border-violet bg-violet/15 text-text' : elapsed[k] > 0 ? 'border-good/40 text-good' : 'border-border text-muted'}`}>
            {k + 1}. {p.title}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_16rem] gap-4">
        <Card className="p-5 grid gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-violet">
              Fase {i + 1}/{phases.length} · {phase.minutes} min
            </div>
            <div className="text-xl font-bold">{phase.title}</div>
            <div className="text-sm text-muted">{phase.prompt}</div>
            <div className="text-xs text-muted mt-1">{FRAMEWORK[i]?.text}</div>
          </div>
          <textarea
            value={notes[i]}
            onChange={(e) => setNotes((n) => n.map((v, k) => (k === i ? e.target.value : v)))}
            placeholder="Escribe aquí como si lo explicaras en voz alta…"
            className="w-full min-h-[14rem] rounded-xl bg-surface-2 border border-border p-3 text-sm font-mono focus:outline-none focus:border-violet resize-y"
          />
          <div className="flex flex-wrap gap-2">
            {i > 0 && (
              <button className="btn btn-ghost" onClick={() => setI(i - 1)}>
                ← Anterior
              </button>
            )}
            {i < phases.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setI(i + 1)}>
                Siguiente fase →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setStage('eval')}>
                Terminar y autoevaluar
              </button>
            )}
          </div>
        </Card>

        <div className="grid gap-3 content-start">
          <Card className="p-4 text-center">
            <div className="text-xs text-muted">Tiempo de la fase</div>
            <motion.div key={remaining < 0 ? 'over' : 'ok'} animate={remaining < 0 ? { scale: [1, 1.05, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }} className={`text-4xl font-extrabold font-mono tabular-nums ${remaining < 0 ? 'text-bad' : remaining < 60 ? 'text-warn' : ''}`}>
              {fmtClock(remaining)}
            </motion.div>
            <ProgressBar value={elapsed[i] / (phase.minutes * 60)} color={remaining < 0 ? 'var(--bad)' : 'var(--violet)'} height={6} className="mt-2" />
            <div className="text-xs text-muted mt-2">Total {fmtClock(total)} / 45:00</div>
            <button className="btn btn-ghost w-full mt-3 !py-1.5 text-xs" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={14} /> : <Play size={14} />} {running ? 'Pausar' : 'Reanudar'}
            </button>
          </Card>
          <Card className="p-4">
            {peeked.has(i) ? (
              <div>
                <div className="text-xs font-bold uppercase text-muted mb-2">El entrevistador espera…</div>
                <ul className="text-xs space-y-1">
                  {phase.expected.map((e) => (
                    <li key={e}>• {e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <button className="btn btn-ghost w-full text-xs" onClick={() => setPeeked((p) => new Set(p).add(i))}>
                <Eye size={14} /> Ver qué se espera (−4 pts)
              </button>
            )}
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {followUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 40, scale: 0.95 }} animate={{ y: 0, scale: 1 }} className="card p-6 max-w-lg w-full">
              <div className="text-xs font-bold uppercase text-violet mb-1">🎤 El entrevistador interrumpe</div>
              <div className="text-lg font-bold mb-3">"{followUp.q}"</div>
              {followUp.shown ? (
                <div className="text-sm text-muted mb-4">💡 {followUp.a}</div>
              ) : (
                <p className="text-sm text-muted mb-4">Piensa tu respuesta (anótala en tus notas) y luego compara.</p>
              )}
              <div className="flex gap-2">
                {!followUp.shown && (
                  <button className="btn btn-ghost" onClick={() => setFollowUp({ ...followUp, shown: true })}>
                    Ver respuesta sugerida
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setNotes((n) => n.map((v, k) => (k === i ? `${v}\n\n[Pregunta: ${followUp.q}]\n` : v)))
                    setFollowUp(null)
                  }}
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MockInterview() {
  const { id } = useParams()
  const c = CASES.find((x) => x.id === id)
  if (!c) return <Empty icon="🎤" title="Caso no encontrado" />
  return (
    <div>
      <Link to={`/interview/${c.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4">
        <ArrowLeft size={16} /> {c.title}
      </Link>
      <Mock c={c} />
    </div>
  )
}
