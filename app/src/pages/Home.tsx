import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { ArrowRight, Brain, Calculator, Mic, Network } from 'lucide-react'
import { TOPICS, ALL_FLASHCARDS, DOMAINS } from '@/data/topics'
import { CHALLENGES } from '@/data/challenges'
import { PUZZLES, TREASURY, levelInfo, streakOf, topicCompleted, useGame } from '@/store/game'
import { Card, ProgressBar, Ring, SectionTitle } from '@/components/ui'
import { Heatmap, SkillRadar } from '@/components/charts'
import { QuestionView } from '@/components/Quiz'
import { dayKey, hashString } from '@/lib/format'

function useNextTopic() {
  const topics = useGame((s) => s.topics)
  return useMemo(() => {
    const ready = TOPICS.find((t) => !topicCompleted(topics[t.id]) && t.prerequisites.every((p) => topicCompleted(topics[p])))
    return ready ?? TOPICS.find((t) => !topicCompleted(topics[t.id]))
  }, [topics])
}

function DailyChallenge() {
  const today = dayKey()
  const doneToday = useGame((s) => s.dailyDone[today])
  const complete = useGame((s) => s.completeDaily)
  const all = useMemo(() => TOPICS.flatMap((t) => t.quiz.map((q) => ({ q, topic: t }))), [])
  const pick = all[hashString(today) % all.length]
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-warn/10 blur-2xl" />
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-warn">☀️ Reto diario · +30 XP</div>
          <div className="text-xs text-muted">Tema: {pick.topic.title}</div>
        </div>
        {doneToday && <span className="chip !text-good !border-good/40">✓ Completado</span>}
      </div>
      {doneToday ? (
        <div className="text-sm text-muted">Vuelve mañana para un nuevo reto. Mientras tanto, prueba el Design Lab o repasa tus flashcards.</div>
      ) : (
        <QuestionView q={pick.q} onAnswered={(ok) => complete(ok)} seed={hashString(today)} />
      )}
    </Card>
  )
}

export default function Home() {
  const nav = useNavigate()
  const xp = useGame((s) => s.xp)
  const activity = useGame((s) => s.activity)
  const topics = useGame((s) => s.topics)
  const cards = useGame((s) => s.cards)
  const labs = useGame((s) => s.labs)
  const quest = useGame((s) => s.quest)
  const goal = useGame((s) => s.settings.dailyGoal)
  const lv = levelInfo(xp)
  const streak = streakOf(activity)
  const todayXp = activity[dayKey()] ?? 0
  const next = useNextTopic()
  const completed = TOPICS.filter((t) => topicCompleted(topics[t.id])).length
  const sims = Object.values(topics).filter((t) => t.simDone).length
  const stars = Object.values(labs).reduce((a, l) => a + l.stars, 0)
  const due = ALL_FLASHCARDS.filter((c) => (cards[c.id]?.due ?? 0) <= Date.now()).length
  const isNew = xp === 0

  return (
    <div className="grid gap-6">
      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-violet/20 p-5 sm:p-7">
        <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />
        <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-accent mb-2">{isNew ? 'Bienvenido a SysDesign Quest' : `Nivel ${lv.level} · ${lv.title}`}</div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              {isNew ? (
                <>
                  Aprende a diseñar sistemas
                  <br className="hidden sm:block" /> que <span className="text-accent">escalan</span>.
                </>
              ) : (
                <>
                  {todayXp >= goal ? '¡Meta diaria cumplida! 🎉' : streak ? `🔥 ${streak} día${streak > 1 ? 's' : ''} de racha. ¡Sigue así!` : 'Hoy es un buen día para escalar.'}
                </>
              )}
            </h1>
            <p className="text-muted mt-2 max-w-xl text-sm sm:text-base">
              Teoría con widgets interactivos, simuladores en vivo, un laboratorio de arquitectura con chaos testing, entrevistas simuladas y código real en <b className="text-text">Java</b> y <b className="text-text">Python</b> con equivalentes en AWS, Azure y GCP.
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              {next && (
                <button className="btn btn-primary" onClick={() => nav(`/topic/${next.id}`)}>
                  {isNew ? 'Empezar por' : 'Continuar:'} {next.icon} {next.title} <ArrowRight size={16} />
                </button>
              )}
              <Link to="/map" className="btn btn-ghost">
                Ver mapa de skills
              </Link>
            </div>
          </div>
          <div className="flex md:flex-col items-center gap-5 md:gap-3">
            <Ring value={Math.min(1, todayXp / goal)} size={104} stroke={10} color="var(--warn)">
              <div className="text-center leading-tight">
                <div className="text-xl font-extrabold tabular-nums">{todayXp}</div>
                <div className="text-[10px] text-muted">/ {goal} XP hoy</div>
              </div>
            </Ring>
            <div className="grid gap-1 min-w-[10rem] md:text-center">
              <div className="text-xs text-muted">Nivel {lv.level} → {lv.next?.title ?? 'MAX'}</div>
              <ProgressBar value={lv.progress} />
              <div className="text-[11px] text-muted tabular-nums">{lv.toNext ? `${lv.toNext} XP restantes` : 'Nivel máximo'}</div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Ruta de entrevista */}
      <Link to="/path" className="group card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-2 !border-good/40 hover:!border-good transition-colors">
        <span className="text-4xl">🎯</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-good">Ruta de entrevista</div>
          <div className="font-bold">Java Backend & Team Lead · Pagos</div>
          <p className="text-sm text-muted mt-1">3 etapas: fundamentos y diagnóstico en producción, diseño distribuido y resiliencia, y liderazgo C-level. Temas, puzzles de NIMBUS, simulacro y historias STAR.</p>
        </div>
        <span className="btn btn-primary shrink-0">Abrir ruta →</span>
      </Link>

      {/* Aventura */}
      <Link to="/quest" className="group relative overflow-hidden rounded-3xl border-2 border-violet/50 bg-[radial-gradient(ellipse_at_top_left,#2a2160_0%,#0b1020_70%)] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-violet transition-colors">
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-5xl drop-shadow-[0_0_16px_rgba(126,240,255,0.6)]">
          💎
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="font-['Press_Start_2P'] text-sm sm:text-base text-white tracking-wider">NIMBUS · El Reino Distribuido</div>
          <p className="text-sm text-[#c9d1e8] mt-2 max-w-2xl">Un RPG de aventura con puzles: restaura los 5 pilares del reino con balanceo de carga, caché, consistent hashing, colas y quórum, y derrota a la Horda del Viernes Negro.</p>
          {quest.started && (
            <div className="text-xs text-[#fde68a] mt-2">
              Pilares {PUZZLES.filter((p) => (quest.pillars[p] ?? 0) > 0).length}/5 · Sellos del Tesoro {TREASURY.filter((p) => (quest.pillars[p] ?? 0) > 0).length}/6 · Pergaminos {quest.scrolls.length}/10{quest.bossStars > 0 ? ' · 🐉 ¡Horda derrotada!' : ''}
            </div>
          )}
        </div>
        <span className="btn btn-primary shrink-0 group-hover:scale-105 transition-transform">{quest.started ? '▶ Continuar aventura' : '▶ Jugar'}</span>
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Temas completados', value: `${completed}/${TOPICS.length}`, p: completed / TOPICS.length, color: 'var(--accent)' },
          { label: 'Simuladores superados', value: `${sims}/${TOPICS.filter((t) => t.simulator).length}`, p: sims / TOPICS.filter((t) => t.simulator).length, color: 'var(--violet)' },
          { label: 'Estrellas en el Lab', value: `${stars}/${CHALLENGES.length * 3}`, p: stars / (CHALLENGES.length * 3), color: 'var(--warn)' },
          { label: 'Flashcards pendientes', value: due, p: 1 - due / ALL_FLASHCARDS.length, color: 'var(--good)' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-muted">{s.label}</div>
            <div className="text-2xl font-extrabold mt-1 mb-2 tabular-nums">{s.value}</div>
            <ProgressBar value={s.p} color={s.color} height={5} />
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <DailyChallenge />
        <div className="grid grid-cols-2 gap-3 content-start">
          {[
            { to: '/lab', icon: Network, title: 'Design Lab', desc: 'Construye arquitecturas y pruébalas con tráfico real', color: 'text-accent' },
            { to: '/interview', icon: Mic, title: 'Entrevista simulada', desc: '45 min, con fases y rúbrica', color: 'text-violet' },
            { to: '/estimate', icon: Calculator, title: 'Estimación', desc: 'Back-of-the-envelope contra reloj', color: 'text-warn' },
            { to: '/review', icon: Brain, title: `Repaso (${due})`, desc: 'Flashcards con repetición espaciada', color: 'text-good' },
          ].map((a) => (
            <Link key={a.to} to={a.to} className="card p-4 hover:border-accent/60 transition-colors group">
              <a.icon className={`${a.color} mb-2 group-hover:scale-110 transition-transform`} size={22} />
              <div className="font-bold text-sm">{a.title}</div>
              <div className="text-xs text-muted mt-0.5">{a.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle sub="Dominio por área (lectura, simulador, código y quiz)">Radar de habilidades</SectionTitle>
          <SkillRadar />
        </Card>
        <Card className="p-5">
          <SectionTitle sub="Cada cuadro es un día">Actividad</SectionTitle>
          <Heatmap />
          <div className="mt-5 grid gap-2">
            <div className="text-xs font-semibold text-muted">Progreso por área</div>
            {Object.values(DOMAINS).map((d) => {
              const ts = TOPICS.filter((t) => t.domain === d.id)
              const c = ts.filter((t) => topicCompleted(topics[t.id])).length
              return (
                <div key={d.id} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-muted">{d.name}</span>
                  <ProgressBar value={ts.length ? c / ts.length : 0} color={d.color} height={6} />
                  <span className="w-8 text-right tabular-nums">
                    {c}/{ts.length}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
