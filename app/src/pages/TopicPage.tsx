import { Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, ExternalLink, Terminal } from 'lucide-react'
import { DOMAINS, TOPICS, topicById } from '@/data/topics'
import { useGame, type Lang } from '@/store/game'
import { Blocks } from '@/components/Blocks'
import { Quiz } from '@/components/Quiz'
import { CodeBlock } from '@/components/CodeBlock'
import { Card, Empty, Loading, Segmented, Tabs } from '@/components/ui'
import { Rich } from '@/components/Rich'
import { SIMULATORS } from '@/sims'
import type { Topic } from '@/data/types'

type Tab = 'learn' | 'sim' | 'code' | 'cloud' | 'real' | 'interview' | 'quiz'

function CloudTable({ topic }: { topic: Topic }) {
  const pref = useGame((s) => s.settings.cloud)
  const cols = [
    { id: 'aws', label: 'AWS' },
    { id: 'azure', label: 'Azure' },
    { id: 'gcp', label: 'GCP' },
  ] as const
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2">
          <tr>
            <th className="text-left px-3 py-2 text-xs uppercase text-muted">Concepto</th>
            {cols.map((c) => (
              <th key={c.id} className={`text-left px-3 py-2 text-xs uppercase ${pref === c.id ? 'text-accent' : 'text-muted'}`}>
                {c.label} {pref === c.id && '★'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topic.cloud.map((row) => (
            <tr key={row.concept} className="border-t border-border">
              <td className="px-3 py-2 font-semibold">{row.concept}</td>
              {cols.map((c) => (
                <td key={c.id} className={`px-3 py-2 ${pref === c.id ? 'text-text bg-accent/5' : 'text-muted'}`}>
                  {row[c.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TopicPage() {
  const { id } = useParams()
  const topic = topicById(id ?? '')
  const progress = useGame((s) => (id ? s.topics[id] : undefined))
  const mark = useGame((s) => s.markTopic)
  const lang = useGame((s) => s.settings.lang)
  const setSettings = useGame((s) => s.setSettings)
  const seeLang = useGame((s) => s.seeLang)
  const [tab, setTab] = useState<Tab>('learn')

  useEffect(() => setTab('learn'), [id])

  if (!topic) return <Empty icon="🤷" title="Tema no encontrado" />

  const idx = TOPICS.findIndex((t) => t.id === topic.id)
  const nextTopic = TOPICS[idx + 1]
  const domain = DOMAINS[topic.domain]
  const Sim = topic.simulator ? SIMULATORS[topic.simulator] : null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'learn', label: `📖 Aprender${progress?.read ? ' ✓' : ''}` },
    ...(Sim ? [{ id: 'sim' as Tab, label: `🕹️ Simulador${progress?.simDone ? ' ✓' : ''}` }] : []),
    ...(topic.code ? [{ id: 'code' as Tab, label: `💻 Código${progress?.codeViewed ? ' ✓' : ''}` }] : []),
    { id: 'cloud', label: '☁️ Cloud' },
    { id: 'real', label: '🏢 Mundo real' },
    { id: 'interview', label: '🎤 Entrevista' },
    { id: 'quiz', label: `🎯 Quiz${progress?.quizBest !== undefined ? ` ${progress.quizBest}%` : ''}` },
  ]

  const openCode = (l: Lang) => {
    setSettings({ lang: l })
    seeLang(l)
    if (!progress?.codeViewed) mark(topic.id, { codeViewed: true }, 15, 'Código revisado')
  }

  return (
    <div>
      <Link to="/map" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4">
        <ArrowLeft size={16} /> Mapa
      </Link>

      <motion.header key={topic.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <div className="flex items-start gap-4">
          <div className="text-4xl sm:text-5xl">{topic.icon}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2 mb-1">
              <span className="chip" style={{ color: domain.color, borderColor: domain.color }}>{domain.name}</span>
              <span className="chip">⏱ ~{topic.minutes} min</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{topic.title}</h1>
            <p className="text-muted text-sm sm:text-base">{topic.subtitle}</p>
          </div>
        </div>
      </motion.header>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="pt-5">
        {tab === 'learn' && (
          <div className="max-w-3xl">
            <Blocks blocks={topic.blocks} />
            <div className="mt-8 flex flex-wrap gap-2">
              {!progress?.read ? (
                <button className="btn btn-primary" onClick={() => { mark(topic.id, { read: true }, 20, 'Lección leída'); setTab(Sim ? 'sim' : topic.code ? 'code' : 'quiz') }}>
                  ✓ Marcar como leído (+20 XP) y seguir
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => setTab(Sim ? 'sim' : 'quiz')}>
                  Siguiente: {Sim ? 'Simulador' : 'Quiz'} →
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'sim' && Sim && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{Sim.icon}</span>
              <div>
                <div className="font-bold text-lg">{Sim.title}</div>
                <div className="text-sm text-muted">{topic.simIntro}</div>
              </div>
            </div>
            <Suspense fallback={<Loading />}>
              <Sim.Component done={!!progress?.simDone} onComplete={() => mark(topic.id, { simDone: true }, 50, `Reto: ${Sim.title}`)} />
            </Suspense>
          </div>
        )}

        {tab === 'code' && topic.code && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold">{topic.code.title}</div>
                <div className="text-xs text-muted">Código real y ejecutable de la carpeta <code className="font-mono">labs/</code> del proyecto</div>
              </div>
              <Segmented value={lang} onChange={openCode} options={[{ id: 'java', label: '☕ Java 17+' }, { id: 'python', label: '🐍 Python 3.10+' }]} />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono bg-surface-2 border border-border rounded-lg px-3 py-2 overflow-x-auto">
              <Terminal size={14} className="text-accent shrink-0" />
              <span className="whitespace-nowrap">{lang === 'java' ? topic.code.runJava : topic.code.runPython}</span>
            </div>
            <CodeBlockOnView code={lang === 'java' ? topic.code.java : topic.code.python} language={lang} onView={() => openCode(lang)} />
            <Card className="p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Notas</div>
              <ul className="space-y-1.5 text-sm">
                {topic.code.notes.map((n) => (
                  <li key={n} className="flex gap-2">
                    <span className="text-accent">▸</span>
                    <span>
                      <Rich text={n} auto />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'cloud' && (
          <div className="grid gap-4 max-w-4xl">
            <p className="text-sm text-muted">Cómo se llama este concepto en cada proveedor. Tu nube preferida (★) se cambia en el perfil.</p>
            <CloudTable topic={topic} />
            <Link to="/cloud" className="text-sm text-accent hover:underline">Ver la Cloud Rosetta completa →</Link>
          </div>
        )}

        {tab === 'real' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {topic.realWorld.map((r) => (
              <Card key={r.title} className="p-5">
                <div className="text-xs font-bold uppercase tracking-wide text-accent">{r.company}</div>
                <div className="font-bold mt-1 mb-2">{r.title}</div>
                <p className="text-sm text-muted leading-relaxed prose-sd">
                  <Rich text={r.text} auto />
                </p>
              </Card>
            ))}
            <Card className="p-5 sm:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Para profundizar</div>
              <div className="grid gap-1.5">
                {topic.resources.map((r) => (
                  <a key={r.url + r.title} href={r.url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline inline-flex items-center gap-1.5">
                    <ExternalLink size={13} /> {r.title}
                  </a>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'interview' && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5 md:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wide text-violet mb-3">🎤 Preguntas típicas</div>
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                {topic.interview.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </Card>
            <Card className="p-5 border-good/40">
              <div className="text-xs font-bold uppercase tracking-wide text-good mb-3">✅ Lo que suma puntos</div>
              <ul className="space-y-2 text-sm">
                {topic.interview.tips.map((t) => (
                  <li key={t} className="flex gap-2"><span>•</span>{t}</li>
                ))}
              </ul>
            </Card>
            <Card className="p-5 border-bad/40">
              <div className="text-xs font-bold uppercase tracking-wide text-bad mb-3">🚩 Red flags</div>
              <ul className="space-y-2 text-sm">
                {topic.interview.redFlags.map((t) => (
                  <li key={t} className="flex gap-2"><span>•</span>{t}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'quiz' && (
          <Card className="p-5 sm:p-6 max-w-2xl">
            <Quiz
              key={topic.id}
              questions={topic.quiz}
              best={progress?.quizBest}
              onFinish={(pct) => {
                const prev = progress?.quizBest ?? 0
                const xp = pct > prev ? Math.round((pct - prev) * 1) : 5
                mark(topic.id, { quizBest: pct }, xp, `Quiz: ${pct}%`)
              }}
            />
          </Card>
        )}
      </motion.div>

      {nextTopic && (
        <div className="mt-10 pt-6 border-t border-border flex justify-end">
          <Link to={`/topic/${nextTopic.id}`} className="btn btn-ghost">
            Siguiente tema: {nextTopic.icon} {nextTopic.title} →
          </Link>
        </div>
      )}
    </div>
  )
}

function CodeBlockOnView({ code, language, onView }: { code: string; language: string; onView: () => void }) {
  useEffect(() => {
    onView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <CodeBlock code={code} language={language} />
}
