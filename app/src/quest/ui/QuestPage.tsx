import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Volume2, VolumeX, X } from 'lucide-react'
import type * as Phaser from 'phaser'
import { bus, setBlocking, touch, type BriefData, type DialogScript, type ResultData } from '../bus'
import { chip } from '../audio'
import { objective, pillarCount, sealCount } from '../story'
import { DialogBox } from './DialogBox'
import { Brief, Codex, Result, TitleScreen } from './Overlays'
import { Toasts } from '@/components/Toasts'
import { PUZZLES, QUEST_INITIAL, useGame } from '@/store/game'
import { SCROLLS } from '../world/map'

function TouchPad() {
  const bind = (k: keyof typeof touch) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      touch[k] = true
    },
    onPointerUp: () => (touch[k] = false),
    onPointerCancel: () => (touch[k] = false),
    onPointerLeave: () => (touch[k] = false),
  })
  const btn = 'absolute w-14 h-14 rounded-xl bg-white/10 border border-white/20 active:bg-[#22d3ee]/40 text-white text-xl flex items-center justify-center touch-none select-none'
  return (
    <>
      <div className="absolute left-3 bottom-4 w-44 h-44 z-20" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <button className={`${btn} left-[60px] top-0`} {...bind('up')} aria-label="Arriba">▲</button>
        <button className={`${btn} left-0 top-[60px]`} {...bind('left')} aria-label="Izquierda">◀</button>
        <button className={`${btn} left-[120px] top-[60px]`} {...bind('right')} aria-label="Derecha">▶</button>
        <button className={`${btn} left-[60px] top-[120px]`} {...bind('down')} aria-label="Abajo">▼</button>
      </div>
      <button className="absolute right-5 bottom-10 z-20 w-20 h-20 rounded-full bg-[#22d3ee]/30 border-2 border-[#22d3ee] text-white font-['Press_Start_2P'] text-lg active:bg-[#22d3ee]/70 touch-none select-none" style={{ marginBottom: 'env(safe-area-inset-bottom)' }} {...bind('action')} aria-label="Acción">
        A
      </button>
    </>
  )
}

export default function QuestPage() {
  const navigate = useNavigate()
  const host = useRef<HTMLDivElement>(null)
  const game = useRef<Phaser.Game | null>(null)
  const [playing, setPlaying] = useState(false)
  const [scene, setScene] = useState<'world' | 'puzzle' | 'title'>('title')
  const [dialog, setDialog] = useState<DialogScript | null>(null)
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [result, setResult] = useState<ResultData | null>(null)
  const [codex, setCodex] = useState(false)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [region, setRegion] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: number; text: string; icon?: string }[]>([])
  const [rotateHint, setRotateHint] = useState(true)
  const quest = useGame((s) => s.quest)
  const questUpdate = useGame((s) => s.questUpdate)
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const [portraitMode, setPortraitMode] = useState(() => typeof window !== 'undefined' && window.innerHeight > window.innerWidth)

  // tema oscuro fijo para el juego
  useEffect(() => {
    const prev = document.documentElement.dataset.theme
    document.documentElement.dataset.theme = 'dark'
    const onResize = () => setPortraitMode(window.innerHeight > window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => {
      document.documentElement.dataset.theme = prev
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // eventos del juego
  useEffect(() => {
    const offs = [
      bus.on('dialog', (d) => setDialog(d)),
      bus.on('brief', (b) => setBrief(b)),
      bus.on('result', (r) => setResult(r)),
      bus.on('prompt', (p) => setPrompt(p)),
      bus.on('scene', (s) => setScene(s)),
      bus.on('region', (r) => {
        setRegion(r)
        window.setTimeout(() => setRegion((cur) => (cur === r ? null : cur)), 2600)
      }),
      bus.on('toast', (t) => {
        const id = Date.now() + Math.random()
        setToasts((ts) => [...ts, { id, ...t }])
        window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3200)
      }),
    ]
    return () => offs.forEach((o) => o())
  }, [])

  // música según preferencia
  useEffect(() => {
    chip.setMuted(!quest.music)
  }, [quest.music])

  // destruir el juego al salir de la página
  useEffect(
    () => () => {
      game.current?.destroy(true)
      game.current = null
      chip.stop()
      setBlocking(false)
      Object.keys(touch).forEach((k) => (touch[k as keyof typeof touch] = false))
    },
    [],
  )

  const start = useCallback(async () => {
    chip.unlock()
    chip.setMuted(!useGame.getState().quest.music)
    setPlaying(true)
    if (game.current || !host.current) return
    const { createGame } = await import('../game')
    if (!host.current) return
    game.current = await createGame(host.current)
    // acceso de depuración solo en desarrollo
    if (import.meta.env.DEV) (window as unknown as { __nimbus: Phaser.Game }).__nimbus = game.current
  }, [])

  const reset = () => questUpdate({ ...QUEST_INITIAL, music: quest.music })

  const pillars = pillarCount(quest)
  const modalOpen = !!dialog || !!brief || !!result || codex

  return (
    <div className="fixed inset-0 bg-[#0b1020] text-[#e6eaf5] overflow-hidden select-none">
      <div ref={host} className="absolute inset-0" />

      {/* HUD */}
      {playing && scene === 'world' && (
        <div className="absolute top-0 inset-x-0 z-10 p-2 sm:p-3 flex items-start justify-between gap-2 pointer-events-none" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
          <div className="rounded-xl bg-black/45 backdrop-blur px-3 py-2 pointer-events-auto max-w-[70vw]">
            <div className="flex items-center gap-1.5">
              {PUZZLES.map((p) => (
                <span key={p} className={`w-3.5 h-3.5 rotate-45 rounded-[3px] border ${(quest.pillars[p] ?? 0) > 0 ? 'bg-[#7ef0ff] border-white shadow-[0_0_8px_#7ef0ff]' : 'bg-[#1b2547] border-[#3b4a80]'}`} />
              ))}
              <span className="text-[11px] ml-2 font-['Press_Start_2P'] text-[#c9d1e8]">{pillars}/5</span>
              <span className="text-xs ml-3 text-[#c9d1e8]">
                📜 {quest.scrolls.length}/{SCROLLS.length}
              </span>
              <span className="text-xs ml-3 text-[#fde68a]" title="Sellos del Distrito del Tesoro">
                🏦 {sealCount(quest)}/6
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-[#fde68a] mt-1.5 leading-snug">🎯 {objective(quest)}</div>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button onClick={() => { setBlocking(true); setCodex(true) }} className="rounded-xl bg-black/45 backdrop-blur p-2.5 hover:bg-black/60" aria-label="Códice">
              <BookOpen size={18} />
            </button>
            <button onClick={() => questUpdate({ music: !quest.music })} className="rounded-xl bg-black/45 backdrop-blur p-2.5 hover:bg-black/60" aria-label="Sonido">
              {quest.music ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={() => navigate('/')} className="rounded-xl bg-black/45 backdrop-blur p-2.5 hover:bg-black/60" aria-label="Salir al curso">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      {playing && scene === 'puzzle' && (
        <button onClick={() => questUpdate({ music: !quest.music })} className="absolute bottom-3 right-3 z-10 rounded-xl bg-black/45 p-2.5" aria-label="Sonido">
          {quest.music ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      )}

      {/* Nombre de región */}
      <AnimatePresence>
        {region && scene === 'world' && !modalOpen && (
          <motion.div key={region} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-24 inset-x-0 z-10 flex justify-center pointer-events-none">
            <div className="font-['Press_Start_2P'] text-xs sm:text-sm text-white bg-black/50 px-5 py-3 rounded-xl border border-white/20 tracking-wider">{region}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pista de interacción */}
      {playing && scene === 'world' && prompt && !modalOpen && (
        <div className={`absolute inset-x-0 z-10 flex justify-center pointer-events-none ${coarse ? 'bottom-52' : 'bottom-6'}`}>
          <div className="rounded-full bg-black/60 border border-[#22d3ee]/50 px-4 py-2 text-sm font-semibold">{prompt}</div>
        </div>
      )}

      {/* Toasts del juego */}
      <div className="absolute top-20 right-3 z-30 grid gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-[#141c38]/95 border border-[#3b4a80] px-3 py-2 text-sm">
              {t.icon} {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {coarse && playing && scene === 'world' && !modalOpen && <TouchPad />}

      {coarse && playing && scene === 'puzzle' && portraitMode && rotateHint && !brief && (
        <button onClick={() => setRotateHint(false)} className="absolute bottom-3 inset-x-3 z-20 rounded-xl bg-[#fbbf24]/90 text-[#1d1a2b] text-sm font-semibold px-4 py-2">
          📱↻ Gira el teléfono para ver mejor el desafío (toca para ocultar)
        </button>
      )}

      <AnimatePresence>
        {dialog && (
          <DialogBox
            key="dialog"
            script={dialog}
            onDone={(c) => {
              const d = dialog
              setDialog(null)
              d.onClose?.(c)
            }}
          />
        )}
        {brief && (
          <Brief
            key="brief"
            data={brief}
            onClose={() => {
              const b = brief
              setBrief(null)
              b.onClose?.()
            }}
          />
        )}
        {result && (
          <Result
            key="result"
            data={result}
            onClose={() => {
              const r = result
              setResult(null)
              r.onClose?.()
            }}
          />
        )}
        {codex && (
          <Codex
            key="codex"
            onClose={() => {
              setCodex(false)
              setBlocking(false)
            }}
          />
        )}
        {!playing && <TitleScreen key="title" onStart={start} onReset={reset} />}
      </AnimatePresence>
      <Toasts />
    </div>
  )
}
