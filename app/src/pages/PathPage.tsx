import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, ChevronDown, Circle, Gamepad2, Mic, Network, Plus, Trash2 } from 'lucide-react'
import { ENGLISH_PHRASES, JAVA_PATH, STAR_THEMES, type PathItem, type PathStage } from '@/data/paths'
import { topicById } from '@/data/topics'
import { CASES } from '@/data/cases'
import { CHALLENGES } from '@/data/challenges'
import { PUZZLE_META } from '@/quest/story'
import { topicCompleted, topicScore, useGame, type StarStory } from '@/store/game'
import { Card, ProgressBar, Ring, SectionTitle } from '@/components/ui'
import { Rich } from '@/components/Rich'

type GameSnapshot = ReturnType<typeof useGame.getState>

function itemStatus(it: PathItem, s: GameSnapshot): { done: boolean; partial: number; meta: string } {
  switch (it.kind) {
    case 'topic': {
      const p = s.topics[it.id]
      return { done: topicCompleted(p), partial: topicScore(p) / 100, meta: p?.quizBest ? `quiz ${p.quizBest}%` : p?.read ? 'leído' : '' }
    }
    case 'puzzle': {
      const stars = it.id === 'boss' ? s.quest.bossStars : (s.quest.pillars[it.id] ?? 0)
      return { done: stars > 0, partial: stars / 3, meta: stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '' }
    }
    case 'case': {
      const best = Math.max(0, ...s.interviews.filter((x) => x.caseId === it.id).map((x) => x.score))
      return { done: best >= 60, partial: best / 100, meta: best ? `mejor ${best}%` : '' }
    }
    case 'lab': {
      const r = s.labs[it.id]
      return { done: (r?.stars ?? 0) >= 1, partial: (r?.stars ?? 0) / 3, meta: r ? '★'.repeat(r.stars) : '' }
    }
    case 'check':
      return { done: !!s.pathChecks[it.id], partial: s.pathChecks[it.id] ? 1 : 0, meta: '' }
  }
}

function ItemRow({ it }: { it: PathItem }) {
  const s = useGame()
  const toggle = useGame((x) => x.togglePathCheck)
  const st = itemStatus(it, s)
  let title = ''
  let icon = ''
  let to = ''
  let tag = ''
  if (it.kind === 'topic') {
    const t = topicById(it.id)
    title = t?.title ?? it.id
    icon = t?.icon ?? '📘'
    to = `/topic/${it.id}`
    tag = 'Tema'
  } else if (it.kind === 'puzzle') {
    const m = PUZZLE_META[it.id]
    title = m.title
    icon = m.icon
    to = '/quest'
    tag = 'NIMBUS'
  } else if (it.kind === 'case') {
    const c = CASES.find((x) => x.id === it.id)
    title = c?.title ?? it.id
    icon = c?.emoji ?? '🎤'
    to = `/interview/${it.id}`
    tag = 'Entrevista'
  } else if (it.kind === 'lab') {
    const c = CHALLENGES.find((x) => x.id === it.id)
    title = `Design Lab: ${c?.title ?? it.id}`
    icon = c?.emoji ?? '🗺️'
    to = `/lab/${it.id}`
    tag = 'Lab'
  }
  if (it.kind === 'check')
    return (
      <button onClick={() => toggle(it.id)} className={`w-full text-left flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${st.done ? 'border-good/50 bg-good/5' : 'border-border hover:border-accent/60'}`}>
        {st.done ? <CheckCircle2 size={20} className="text-good shrink-0 mt-0.5" /> : <Circle size={20} className="text-muted shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <div className="text-sm font-semibold">{it.label}</div>
          <div className="text-xs text-muted">✍️ Práctica · {it.why}</div>
        </div>
      </button>
    )
  return (
    <Link to={to} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${st.done ? 'border-good/50 bg-good/5' : 'border-border hover:border-accent/60'}`}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{title}</span>
          <span className={`chip !text-[10px] !py-0 ${tag === 'NIMBUS' ? '!border-violet/50 !text-violet' : ''}`}>{tag}</span>
          {st.meta && <span className="text-[11px] text-muted">{st.meta}</span>}
        </div>
        <div className="text-xs text-muted">{it.why}</div>
        {!st.done && st.partial > 0 && <ProgressBar value={st.partial} height={4} className="mt-1.5 max-w-[12rem]" />}
      </div>
      {st.done ? <CheckCircle2 size={20} className="text-good shrink-0" /> : <Circle size={20} className="text-muted shrink-0" />}
    </Link>
  )
}

function Drills({ stage }: { stage: PathStage }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <Card className="p-5">
      <div className="font-bold mb-1">🎯 Preguntas de práctica</div>
      <p className="text-sm text-muted mb-3">Respóndelas en voz alta con cronómetro (2–3 min cada una) y luego compara con el guion.</p>
      <div className="grid gap-2">
        {stage.drills.map((d, i) => (
          <div key={i} className="rounded-xl border border-border">
            <button className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold" onClick={() => setOpen(open === i ? null : i)}>
              {d.q}
              <ChevronDown size={16} className={`shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {open === i && (
                <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden list-decimal pl-9 pr-4 pb-3 text-sm text-muted grid gap-1">
                  {d.outline.map((o, k) => (
                    <li key={k}><Rich text={o} /></li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Card>
  )
}

const EMPTY = (theme: string): StarStory => ({ id: `st-${Date.now()}`, title: '', theme, s: '', t: '', a: '', r: '', updated: Date.now() })

function StarBuilder() {
  const stories = useGame((s) => s.stories)
  const save = useGame((s) => s.saveStory)
  const remove = useGame((s) => s.deleteStory)
  const [editing, setEditing] = useState<StarStory | null>(null)
  const words = (st: StarStory) => [st.s, st.t, st.a, st.r].join(' ').split(/\s+/).filter(Boolean).length
  const fields: { k: 's' | 't' | 'a' | 'r'; label: string; ph: string }[] = [
    { k: 's', label: 'S · Situación', ph: 'Contexto en 1–2 frases: empresa, sistema, problema, impacto.' },
    { k: 't', label: 'T · Tarea', ph: 'Tu responsabilidad concreta.' },
    { k: 'a', label: 'A · Acción', ph: 'Lo que TÚ hiciste y por qué (la parte más larga). Comandos, decisiones, comunicación.' },
    { k: 'r', label: 'R · Resultado', ph: 'Impacto medible: dinero, latencia, incidentes, tiempo. Y qué aprendiste.' },
  ]
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="font-bold">🎙️ Mis historias STAR</div>
        <span className="text-xs text-muted">{stories.filter((x) => x.s && x.t && x.a && x.r).length} completas</span>
      </div>
      <p className="text-sm text-muted mb-3">Se guardan en tu navegador. Apunta a 150–250 palabras: unos 90 segundos en voz alta.</p>
      {!editing && (
        <>
          <div className="grid gap-2 mb-3">
            {stories.map((st) => (
              <div key={st.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                <span>{st.s && st.t && st.a && st.r ? '✅' : '📝'}</span>
                <button className="flex-1 min-w-0 text-left" onClick={() => setEditing(st)}>
                  <div className="text-sm font-semibold truncate">{st.title || st.theme}</div>
                  <div className="text-xs text-muted">{st.theme} · {words(st)} palabras</div>
                </button>
                <button className="text-muted hover:text-bad" aria-label="Eliminar historia" onClick={() => remove(st.id)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {STAR_THEMES.filter((t) => !stories.some((s) => s.theme === t)).map((t) => (
              <button key={t} className="chip hover:!border-accent" onClick={() => setEditing(EMPTY(t))}><Plus size={12} /> {t}</button>
            ))}
          </div>
        </>
      )}
      {editing && (
        <div className="grid gap-3">
          <div className="text-xs text-muted">{editing.theme}</div>
          <input className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm" placeholder="Título corto (p. ej. «Doble cobro en quincena»)" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          {fields.map((f) => (
            <label key={f.k} className="grid gap-1">
              <span className="text-sm font-semibold">{f.label}</span>
              <textarea rows={f.k === 'a' ? 4 : 2} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm" placeholder={f.ph} value={editing[f.k]} onChange={(e) => setEditing({ ...editing, [f.k]: e.target.value })} />
            </label>
          ))}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`text-xs ${words(editing) > 260 ? 'text-warn' : 'text-muted'}`}>{words(editing)} palabras {words(editing) > 260 && '· demasiado larga: recorta la Situación'}</span>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => { save({ ...editing, updated: Date.now() }); setEditing(null) }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function English() {
  return (
    <Card className="p-5">
      <div className="font-bold mb-1">🌎 Inglés técnico: frases listas</div>
      <p className="text-sm text-muted mb-3">Léelas en voz alta y adáptalas a tus historias.</p>
      <div className="grid gap-2">
        {ENGLISH_PHRASES.map(([k, v]) => (
          <div key={k} className="grid sm:grid-cols-[12rem_1fr] gap-1 sm:gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">{k}</span>
            <span className="italic">“{v}”</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function PathPage() {
  const s = useGame()
  const [stageId, setStageId] = useState(JAVA_PATH.stages[0].id)
  const stage = JAVA_PATH.stages.find((x) => x.id === stageId)!
  const progress = useMemo(
    () =>
      JAVA_PATH.stages.map((st) => {
        const done = st.items.filter((it) => itemStatus(it, s).done).length
        return { id: st.id, done, total: st.items.length }
      }),
    [s],
  )
  const all = progress.reduce((a, p) => a + p.done, 0)
  const total = progress.reduce((a, p) => a + p.total, 0)

  return (
    <div className="grid gap-6">
      <SectionTitle sub={JAVA_PATH.subtitle} right={<Ring value={all / total} size={72} stroke={8} color="var(--good)"><div className="text-sm font-extrabold tabular-nums">{Math.round((all / total) * 100)}%</div></Ring>}>
        🎯 {JAVA_PATH.title}
      </SectionTitle>

      <div className="grid sm:grid-cols-3 gap-3">
        {JAVA_PATH.stages.map((st, i) => {
          const p = progress[i]
          return (
            <button key={st.id} onClick={() => setStageId(st.id)} className={`card p-4 text-left transition-colors ${st.id === stageId ? '!border-accent bg-accent/5' : 'hover:border-accent/50'}`}>
              <div className="text-xs font-bold uppercase tracking-wider text-accent">{st.icon} {st.label}</div>
              <div className="font-bold text-sm mt-1 leading-snug">{st.title}</div>
              <ProgressBar value={p.done / p.total} className="mt-3" color={p.done === p.total ? 'var(--good)' : 'var(--accent)'} />
              <div className="text-[11px] text-muted mt-1">{p.done}/{p.total} completados</div>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={stage.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-6">
          <div>
            <div className="text-sm font-bold mb-2">Qué evalúan</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stage.focus.map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-surface p-3">
                  <div className="text-sm font-bold">{f.title}</div>
                  <div className="text-xs text-muted mt-1">{f.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_22rem] gap-6 items-start">
            <Card className="p-5">
              <div className="font-bold mb-3">Tu plan para esta etapa</div>
              <div className="grid gap-2">
                {stage.items.map((it) => (
                  <ItemRow key={`${it.kind}-${it.id}`} it={it} />
                ))}
              </div>
            </Card>
            <div className="grid gap-4">
              <div className="rounded-2xl border border-violet/50 bg-violet/10 p-4">
                <div className="font-bold text-sm mb-2">🎤 Claves para destacar</div>
                <ul className="grid gap-2 text-sm">
                  {stage.hints.map((h) => (
                    <li key={h} className="flex gap-2"><span>•</span><span>{h}</span></li>
                  ))}
                </ul>
              </div>
              <Link to="/quest" className="rounded-2xl border border-border bg-[radial-gradient(ellipse_at_top_left,#2a2160_0%,transparent_70%)] p-4 hover:border-violet transition-colors">
                <div className="flex items-center gap-2 font-bold text-sm"><Gamepad2 size={16} /> Distrito del Tesoro (NIMBUS)</div>
                <div className="text-xs text-muted mt-1">Seis pruebas jugables para esta ruta, al noroeste de la plaza de Ciudad Monolito.</div>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/interview/payment-gateway/mock" className="btn btn-ghost !justify-start text-xs"><Mic size={14} /> Simulacro de pagos</Link>
                <Link to="/lab/payments" className="btn btn-ghost !justify-start text-xs"><Network size={14} /> Lab de pagos</Link>
              </div>
            </div>
          </div>

          <Drills stage={stage} />
          {stage.id === 's3' && (
            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <StarBuilder />
              <English />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
