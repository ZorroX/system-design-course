import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Play } from 'lucide-react'
import { CASES } from '@/data/cases'
import { topicById } from '@/data/topics'
import { useGame } from '@/store/game'
import { Diagram } from '@/components/Diagram'
import { Card, Empty, Tabs } from '@/components/ui'
import { Rich } from '@/components/Rich'

type Tab = 'req' | 'est' | 'api' | 'arch' | 'trade' | 'follow' | 'cloud'

function FollowUp({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="p-4">
      <div className="font-semibold text-sm">🎤 {q}</div>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-sm text-muted mt-2">
            <Rich text={a} auto />
          </motion.div>
        ) : (
          <button className="text-xs text-accent mt-2" onClick={() => setOpen(true)}>
            Piensa tu respuesta… luego revela la sugerida
          </button>
        )}
      </AnimatePresence>
    </Card>
  )
}

export default function CasePage() {
  const { id } = useParams()
  const c = CASES.find((x) => x.id === id)
  const cloud = useGame((s) => s.settings.cloud)
  const lang = useGame((s) => s.settings.lang)
  const [tab, setTab] = useState<Tab>('req')
  if (!c) return <Empty icon="🎤" title="Caso no encontrado" />

  return (
    <div className="grid gap-5">
      <div>
        <Link to="/interview" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-3">
          <ArrowLeft size={16} /> Casos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <span className="text-5xl">{c.emoji}</span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{c.title}</h1>
              <div className="text-sm text-muted">Inspirado en {c.inspiredBy}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/interview/${c.id}/mock`} className="btn btn-primary">
              <Play size={16} /> Entrevista simulada
            </Link>
            {c.labChallenge && (
              <Link to={`/lab/${c.labChallenge}`} className="btn btn-ghost">
                🧪 Construir en el Lab
              </Link>
            )}
          </div>
        </div>
        <Card className="p-4 mt-4 border-violet/40 bg-violet/5">
          <div className="text-xs font-bold uppercase tracking-wide text-violet mb-1">El entrevistador dice</div>
          <div className="text-base">"{c.prompt}"</div>
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'req', label: '📋 Requisitos' },
          { id: 'est', label: '🧮 Estimación' },
          { id: 'api', label: '🔌 API y datos' },
          { id: 'arch', label: '🏗️ Arquitectura' },
          { id: 'trade', label: '⚖️ Trade-offs' },
          { id: 'follow', label: '🎤 Seguimiento' },
          { id: 'cloud', label: '☁️ Cloud y stack' },
        ]}
      />

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {tab === 'req' && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="font-bold mb-2">Funcionales</div>
              <ul className="space-y-1.5 text-sm">{c.functional.map((f) => <li key={f}>✅ {f}</li>)}</ul>
            </Card>
            <Card className="p-5">
              <div className="font-bold mb-2">No funcionales</div>
              <ul className="space-y-1.5 text-sm">{c.nonFunctional.map((f) => <li key={f}>📏 {f}</li>)}</ul>
            </Card>
            <Card className="p-5 md:col-span-2">
              <div className="text-xs font-bold uppercase text-muted mb-2">Temas relacionados</div>
              <div className="flex flex-wrap gap-2">
                {c.topics.map((t) => {
                  const tp = topicById(t)
                  return tp ? <Link key={t} to={`/topic/${t}`} className="chip hover:!border-accent">{tp.icon} {tp.title}</Link> : null
                })}
              </div>
            </Card>
          </div>
        )}
        {tab === 'est' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {c.estimation.map((e, i) => (
              <motion.div key={e.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}>
                <Card className="p-4">
                  <div className="text-xs text-muted uppercase font-semibold">{e.label}</div>
                  <div className="text-2xl font-extrabold text-accent">{e.value}</div>
                  <div className="text-xs text-muted font-mono mt-1">{e.how}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
        {tab === 'api' && (
          <div className="grid gap-4">
            <Card className="p-4 overflow-x-auto">
              <div className="font-bold mb-2">API</div>
              <div className="grid gap-2">
                {c.api.map((a) => (
                  <div key={a.path} className="flex flex-wrap items-baseline gap-2 text-sm font-mono">
                    <span className="chip !text-accent !border-accent/50">{a.method}</span>
                    <span className="font-semibold">{a.path}</span>
                    <span className="text-muted font-sans text-xs">{a.desc}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4 overflow-x-auto">
              <div className="font-bold mb-2">Modelo de datos</div>
              <table className="w-full text-sm">
                <tbody>
                  {c.dataModel.map((d) => (
                    <tr key={d.entity} className="border-t border-border first:border-0">
                      <td className="py-2 pr-3 font-mono font-bold whitespace-nowrap align-top">{d.entity}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted align-top">{d.fields}</td>
                      <td className="py-2 text-xs align-top">{d.store}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
        {tab === 'arch' && (
          <div className="grid gap-4">
            <Diagram diagram={c.diagram} />
            <div className="grid md:grid-cols-2 gap-4">
              {c.deepDives.map((d) => (
                <Card key={d.title} className="p-5">
                  <div className="font-bold mb-2">🔬 {d.title}</div>
                  <p className="text-sm text-muted leading-relaxed">
                    <Rich text={d.text} auto />
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}
        {tab === 'trade' && (
          <div className="grid gap-3">
            {c.tradeoffs.map((t) => (
              <Card key={t.decision} className="p-4 grid sm:grid-cols-[10rem_12rem_1fr] gap-2 items-baseline">
                <div className="text-xs uppercase font-bold text-muted">{t.decision}</div>
                <div className="font-bold text-accent">{t.choice}</div>
                <div className="text-sm text-muted">{t.why}</div>
              </Card>
            ))}
          </div>
        )}
        {tab === 'follow' && (
          <div className="grid gap-3">
            {c.followUps.map((f) => (
              <FollowUp key={f.q} {...f} />
            ))}
          </div>
        )}
        {tab === 'cloud' && (
          <div className="grid gap-3">
            {(['aws', 'azure', 'gcp'] as const).map((k) => (
              <Card key={k} className={`p-4 ${cloud === k ? 'border-accent/60' : ''}`}>
                <div className="text-xs font-bold uppercase text-muted mb-1">
                  {k.toUpperCase()} {cloud === k && <span className="text-accent">★ tu nube</span>}
                </div>
                <div className="text-sm">{c.cloud[k]}</div>
              </Card>
            ))}
            <div className="grid md:grid-cols-2 gap-3">
              <Card className={`p-4 ${lang === 'java' ? 'border-accent/60' : ''}`}>
                <div className="text-xs font-bold uppercase text-muted mb-1">☕ Stack Java</div>
                <div className="text-sm">{c.stackJava}</div>
              </Card>
              <Card className={`p-4 ${lang === 'python' ? 'border-accent/60' : ''}`}>
                <div className="text-xs font-bold uppercase text-muted mb-1">🐍 Stack Python</div>
                <div className="text-sm">{c.stackPython}</div>
              </Card>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
