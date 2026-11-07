import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dayKey } from '@/lib/format'
import { ACHIEVEMENTS } from '@/data/achievements'
import { TOPICS } from '@/data/topics'
import { CHALLENGES } from '@/data/challenges'
import { ARTICLES } from '@/data/articles'

export type Lang = 'java' | 'python'
export type Cloud = 'aws' | 'azure' | 'gcp'

export interface TopicProgress {
  read?: boolean
  simDone?: boolean
  quizBest?: number // 0..100
  codeViewed?: boolean
}

export interface CardState {
  ease: number
  interval: number // días
  due: number // timestamp
  reps: number
}

export interface InterviewRecord {
  id: string
  caseId: string
  date: number
  score: number
  byPhase: Record<string, number>
  hints: number
  minutes: number
}

export type PuzzleId = 'inn' | 'library' | 'ring' | 'harbor' | 'bridge' | 'vault' | 'forge' | 'tower' | 'caravan' | 'aviary' | 'council'
/** Los cinco pilares de la historia principal. */
export const PUZZLES: PuzzleId[] = ['inn', 'library', 'ring', 'harbor', 'bridge']
/** Los seis sellos del Distrito del Tesoro (ruta de entrevista Java / pagos). */
export const TREASURY: PuzzleId[] = ['vault', 'forge', 'tower', 'caravan', 'aviary', 'council']

/** Historia en formato STAR para entrevistas de liderazgo. */
export interface StarStory {
  id: string
  title: string
  theme: string
  s: string
  t: string
  a: string
  r: string
  updated: number
}

/** Progreso de la aventura NIMBUS (se guarda junto al resto del progreso del curso). */
export interface QuestState {
  started: boolean
  pos: { x: number; y: number } | null // en tiles
  pillars: Partial<Record<PuzzleId, number>> // estrellas por prueba
  bossStars: number
  scrolls: string[]
  codex: string[]
  talked: string[]
  music: boolean
}

export const QUEST_INITIAL: QuestState = { started: false, pos: null, pillars: {}, bossStars: 0, scrolls: [], codex: [], talked: [], music: true }

export interface LabResult {
  stars: number
  score: number
  cost: number
}

export interface GameState {
  xp: number
  topics: Record<string, TopicProgress>
  activity: Record<string, number>
  achievements: Record<string, number>
  cards: Record<string, CardState>
  cardReviews: number
  labs: Record<string, LabResult>
  chaosSurvived: boolean
  estimations: Record<string, number>
  interviews: InterviewRecord[]
  dailyDone: Record<string, boolean>
  langsSeen: Lang[]
  articlesRead: string[]
  quest: QuestState
  stories: StarStory[]
  pathChecks: Record<string, boolean>
  settings: { lang: Lang; cloud: Cloud; theme: 'dark' | 'light'; dailyGoal: number; sound: boolean; autoTerms: boolean }

  addXp: (amount: number, reason: string) => void
  markTopic: (id: string, patch: TopicProgress, xp?: number, reason?: string) => void
  reviewCard: (id: string, grade: 0 | 3 | 4 | 5) => void
  saveLab: (id: string, r: LabResult) => void
  setChaosSurvived: () => void
  saveEstimation: (id: string, score: number) => void
  saveInterview: (r: InterviewRecord) => void
  completeDaily: (correct: boolean) => void
  seeLang: (l: Lang) => void
  readArticle: (id: string) => void
  questUpdate: (patch: Partial<QuestState>) => void
  questSolve: (id: PuzzleId | 'boss', stars: number) => void
  questScroll: (scrollId: string, codexId: string) => void
  questCodex: (codexId: string) => void
  saveStory: (story: StarStory) => void
  deleteStory: (id: string) => void
  togglePathCheck: (id: string) => void
  setSettings: (s: Partial<GameState['settings']>) => void
  importState: (json: string) => boolean
  reset: () => void
}

/* ---------- Niveles ---------- */
export const LEVELS = [
  { xp: 0, title: 'Intern' },
  { xp: 150, title: 'Junior I' },
  { xp: 400, title: 'Junior II' },
  { xp: 800, title: 'Mid I' },
  { xp: 1400, title: 'Mid II' },
  { xp: 2200, title: 'Senior I' },
  { xp: 3300, title: 'Senior II' },
  { xp: 4700, title: 'Staff' },
  { xp: 6500, title: 'Principal' },
  { xp: 9000, title: 'Distinguished' },
]

export function levelInfo(xp: number) {
  let i = 0
  while (i < LEVELS.length - 1 && xp >= LEVELS[i + 1].xp) i++
  const cur = LEVELS[i]
  const next = LEVELS[i + 1]
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1
  return { level: i + 1, title: cur.title, next, progress, toNext: next ? next.xp - xp : 0 }
}

export function streakOf(activity: Record<string, number>): number {
  let streak = 0
  const d = new Date()
  // si hoy aún no hay actividad, la racha sigue viva desde ayer
  if (!activity[dayKey(d)]) d.setDate(d.getDate() - 1)
  while (activity[dayKey(d)]) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function topicCompleted(p?: TopicProgress) {
  return (p?.quizBest ?? 0) >= 70
}

export function topicScore(p?: TopicProgress): number {
  if (!p) return 0
  return (p.read ? 20 : 0) + (p.simDone ? 25 : 0) + (p.codeViewed ? 15 : 0) + ((p.quizBest ?? 0) / 100) * 40
}

/* ---------- Toasts (no persistidos) ---------- */
export interface Toast {
  id: number
  kind: 'xp' | 'achievement' | 'level'
  title: string
  text?: string
  icon?: string
}
interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}
let toastId = 1
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'xp' ? 2200 : 4200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

/* ---------- Logros ---------- */
function evaluateAchievements(s: GameState): string[] {
  const completed = TOPICS.filter((t) => topicCompleted(s.topics[t.id])).length
  const sims = Object.values(s.topics).filter((t) => t.simDone).length
  const labsWithStars = Object.values(s.labs).filter((l) => l.stars >= 1).length
  const conds: Record<string, boolean> = {
    'first-lesson': Object.values(s.topics).some((t) => t.read),
    'first-sim': sims >= 1,
    'all-sims': sims >= TOPICS.filter((t) => t.simulator).length,
    'perfect-quiz': Object.values(s.topics).some((t) => (t.quizBest ?? 0) === 100),
    'topics-5': completed >= 5,
    'topics-all': completed >= TOPICS.length,
    'streak-3': streakOf(s.activity) >= 3,
    'streak-7': streakOf(s.activity) >= 7,
    'first-design': labsWithStars >= 1,
    'three-stars': Object.values(s.labs).some((l) => l.stars === 3),
    'all-designs': CHALLENGES.every((c) => (s.labs[c.id]?.stars ?? 0) >= 2),
    chaos: s.chaosSurvived,
    estimator: Object.values(s.estimations).filter((v) => v >= 70).length >= 5,
    'first-interview': s.interviews.length >= 1,
    'interview-ace': s.interviews.some((i) => i.score >= 80),
    'cards-50': s.cardReviews >= 50,
    polyglot: s.langsSeen.length >= 2,
    'xp-1000': s.xp >= 1000,
    'xp-5000': s.xp >= 5000,
    scholar: s.articlesRead.length >= 3,
    encyclopedia: Object.keys(ARTICLES).every((id) => s.articlesRead.includes(id)),
    'quest-begin': s.quest.started,
    'quest-pillar': Object.keys(s.quest.pillars).length >= 1,
    'quest-five': PUZZLES.every((id) => (s.quest.pillars[id] ?? 0) > 0),
    'quest-hero': s.quest.bossStars > 0,
    'quest-scrolls': s.quest.scrolls.length >= 8,
    'quest-treasury': TREASURY.every((id) => (s.quest.pillars[id] ?? 0) > 0),
    'star-stories': s.stories.filter((x) => x.s && x.t && x.a && x.r).length >= 3,
  }
  return ACHIEVEMENTS.filter((a) => conds[a.id] && !s.achievements[a.id]).map((a) => a.id)
}

const initial = {
  xp: 0,
  topics: {},
  activity: {},
  achievements: {},
  cards: {},
  cardReviews: 0,
  labs: {},
  chaosSurvived: false,
  estimations: {},
  interviews: [],
  dailyDone: {},
  langsSeen: [] as Lang[],
  articlesRead: [] as string[],
  quest: QUEST_INITIAL,
  stories: [] as StarStory[],
  pathChecks: {} as Record<string, boolean>,
  settings: { lang: 'java' as Lang, cloud: 'aws' as Cloud, theme: 'dark' as const, dailyGoal: 50, sound: true, autoTerms: true },
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** Aplica un cambio, suma XP, registra actividad y dispara logros/subidas de nivel. */
      const commit = (patch: Partial<GameState>, xp = 0, reason = '') => {
        const before = get()
        const prevLevel = levelInfo(before.xp).level
        const today = dayKey()
        const next: Partial<GameState> = { ...patch }
        if (xp > 0) {
          next.xp = before.xp + xp
          next.activity = { ...before.activity, [today]: (before.activity[today] ?? 0) + xp }
        }
        set(next)
        const toasts = useToasts.getState()
        if (xp > 0) toasts.push({ kind: 'xp', title: `+${xp} XP`, text: reason })

        const unlocked = evaluateAchievements(get())
        if (unlocked.length) {
          let bonus = 0
          const ach = { ...get().achievements }
          for (const id of unlocked) {
            const a = ACHIEVEMENTS.find((x) => x.id === id)!
            ach[id] = Date.now()
            bonus += a.xp
            toasts.push({ kind: 'achievement', title: a.name, text: a.desc, icon: a.icon })
          }
          const s = get()
          set({
            achievements: ach,
            xp: s.xp + bonus,
            activity: { ...s.activity, [today]: (s.activity[today] ?? 0) + bonus },
          })
        }
        const lv = levelInfo(get().xp)
        if (lv.level > prevLevel) toasts.push({ kind: 'level', title: `¡Nivel ${lv.level}!`, text: lv.title })
      }

      return {
        ...initial,
        addXp: (amount, reason) => commit({}, amount, reason),

        markTopic: (id, patch, xp = 0, reason = '') => {
          const s = get()
          const cur = s.topics[id] ?? {}
          const merged: TopicProgress = { ...cur, ...patch }
          if (patch.quizBest !== undefined) merged.quizBest = Math.max(cur.quizBest ?? 0, patch.quizBest)
          commit({ topics: { ...s.topics, [id]: merged } }, xp, reason)
        },

        /** SM-2 simplificado (algoritmo de SuperMemo/Anki). */
        reviewCard: (id, grade) => {
          const s = get()
          const c = s.cards[id] ?? { ease: 2.5, interval: 0, due: 0, reps: 0 }
          let { ease, interval, reps } = c
          if (grade < 3) {
            reps = 0
            interval = 0
          } else {
            reps += 1
            interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease)
            if (grade === 5) interval = Math.round(interval * 1.3) || 2
          }
          ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)))
          const due = grade < 3 ? Date.now() + 60_000 : Date.now() + interval * 86_400_000
          commit(
            { cards: { ...s.cards, [id]: { ease, interval, due, reps } }, cardReviews: s.cardReviews + 1 },
            grade >= 3 ? 3 : 1,
            'Repaso',
          )
        },

        saveLab: (id, r) => {
          const s = get()
          const prev = s.labs[id]
          const prevStars = prev?.stars ?? 0
          const better = !prev || r.score > prev.score
          const xp = Math.max(0, r.stars - prevStars) * 60
          commit({ labs: better ? { ...s.labs, [id]: r } : s.labs }, xp, `Design Lab: ${r.stars}★`)
        },

        setChaosSurvived: () => commit({ chaosSurvived: true }, 0),

        saveEstimation: (id, score) => {
          const s = get()
          const prev = s.estimations[id] ?? 0
          const xp = score > prev ? Math.round((score - prev) / 4) : 0
          commit({ estimations: { ...s.estimations, [id]: Math.max(prev, score) } }, xp, 'Estimación')
        },

        saveInterview: (r) => {
          const s = get()
          commit({ interviews: [r, ...s.interviews].slice(0, 50) }, Math.round(40 + r.score), 'Entrevista simulada')
        },

        completeDaily: (correct) => {
          const s = get()
          commit({ dailyDone: { ...s.dailyDone, [dayKey()]: true } }, correct ? 30 : 5, 'Reto diario')
        },

        seeLang: (l) => {
          const s = get()
          if (!s.langsSeen.includes(l)) commit({ langsSeen: [...s.langsSeen, l] }, 0)
        },

        readArticle: (id) => {
          const s = get()
          if (!s.articlesRead.includes(id)) commit({ articlesRead: [...s.articlesRead, id] }, 10, 'Artículo leído')
        },

        questUpdate: (patch) => set((s) => ({ quest: { ...s.quest, ...patch } })),

        /** Recompensa: primera vez 100 XP + 20/estrella; mejoras 20 XP por estrella extra. Jefe: 300 + 50/estrella. */
        questSolve: (id, stars) => {
          const s = get()
          const prev = id === 'boss' ? s.quest.bossStars : (s.quest.pillars[id] ?? 0)
          if (stars <= prev) return
          const first = prev === 0
          const xp = id === 'boss' ? (first ? 300 : 0) + 50 * (stars - prev) : (first ? 100 : 0) + 20 * (stars - prev)
          const label = id === 'boss' ? 'NIMBUS: ¡jefe derrotado!' : TREASURY.includes(id) ? 'NIMBUS: sello del Tesoro' : 'NIMBUS: pilar restaurado'
          const quest = id === 'boss' ? { ...s.quest, bossStars: stars } : { ...s.quest, pillars: { ...s.quest.pillars, [id]: stars } }
          commit({ quest }, xp, label)
        },

        questScroll: (scrollId, codexId) => {
          const s = get()
          if (s.quest.scrolls.includes(scrollId)) return
          const codex = s.quest.codex.includes(codexId) ? s.quest.codex : [...s.quest.codex, codexId]
          commit({ quest: { ...s.quest, scrolls: [...s.quest.scrolls, scrollId], codex } }, 15, 'Pergamino encontrado')
        },

        questCodex: (codexId) => {
          const s = get()
          if (!s.quest.codex.includes(codexId)) set({ quest: { ...s.quest, codex: [...s.quest.codex, codexId] } })
        },

        saveStory: (story) => {
          const s = get()
          const exists = s.stories.some((x) => x.id === story.id)
          const complete = story.s && story.t && story.a && story.r
          const wasComplete = s.stories.some((x) => x.id === story.id && x.s && x.t && x.a && x.r)
          commit(
            { stories: exists ? s.stories.map((x) => (x.id === story.id ? story : x)) : [...s.stories, story] },
            complete && !wasComplete ? 25 : 0,
            'Historia STAR lista',
          )
        },

        deleteStory: (id) => set((s) => ({ stories: s.stories.filter((x) => x.id !== id) })),

        togglePathCheck: (id) => {
          const s = get()
          const on = !s.pathChecks[id]
          commit({ pathChecks: { ...s.pathChecks, [id]: on } }, on ? 5 : 0, 'Ruta de entrevista')
        },

        setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

        importState: (json) => {
          try {
            const data = JSON.parse(json)
            if (typeof data !== 'object' || data === null || typeof data.xp !== 'number') return false
            set({ ...initial, ...data, quest: { ...QUEST_INITIAL, ...(data.quest ?? {}) }, settings: { ...initial.settings, ...(data.settings ?? {}) } })
            return true
          } catch {
            return false
          }
        },

        reset: () => set({ ...initial }),
      }
    },
    {
      name: 'sysdesign-quest-v1',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>
        return { ...current, ...p, quest: { ...QUEST_INITIAL, ...(p.quest ?? {}) }, settings: { ...current.settings, ...(p.settings ?? {}) } }
      },
      partialize: (s) =>
        Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as Partial<GameState>,
    },
  ),
)
