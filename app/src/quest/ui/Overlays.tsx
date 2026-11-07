import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { Rich } from '@/components/Rich'
import { topicById } from '@/data/topics'
import { PUZZLES, TREASURY, useGame } from '@/store/game'
import { SCROLLS } from '../world/map'
import type { BriefData, ResultData } from '../bus'
import { CODEX } from '../story'
import { portrait } from '../art'

function useKey(keys: string[], fn: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (keys.includes(e.key)) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [keys, fn])
}

export function Brief({ data, onClose }: { data: BriefData; onClose: () => void }) {
  useKey(['Enter', 'Escape'], onClose)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/60 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-lg rounded-2xl border-2 border-[#3b4a80] bg-[#0f1630] p-5 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{data.icon ?? '🎯'}</span>
          <div className="font-['Press_Start_2P'] text-xs sm:text-sm text-[#22d3ee] leading-relaxed">{data.title}</div>
        </div>
        <div className="rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/40 px-4 py-2.5 text-sm text-[#fde68a] font-semibold mb-3">🎯 {data.goal}</div>
        <ul className="space-y-2 text-sm text-[#e6eaf5] mb-3">
          {data.how.map((h) => (
            <li key={h} className="flex gap-2">
              <span className="text-[#22d3ee]">▸</span>
              <span>
                <Rich text={h} />
              </span>
            </li>
          ))}
        </ul>
        {data.concept && (
          <div className="rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/40 px-4 py-2.5 text-sm text-[#e6eaf5] prose-sd mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#a78bfa]">Concepto · </span>
            <Rich text={data.concept} />
          </div>
        )}
        <button onClick={onClose} className="w-full rounded-xl bg-[#22d3ee] text-[#04131a] font-bold py-3 hover:brightness-110 active:scale-[0.98] transition">
          {data.button ?? '¡Entendido!'}
        </button>
      </motion.div>
    </motion.div>
  )
}

export function Result({ data, onClose }: { data: ResultData; onClose: () => void }) {
  useKey(['Enter', 'Escape'], onClose)
  const ok = data.stars > 0
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="w-full max-w-lg rounded-2xl border-2 border-[#fbbf24]/60 bg-[#0f1630] p-6 text-center shadow-2xl my-auto">
        <div className="font-['Press_Start_2P'] text-[11px] text-[#8f9bbd] mb-2">{ok ? (data.puzzle === 'boss' ? '¡VICTORIA!' : 'PILAR RESTAURADO') : 'PRUEBA INCOMPLETA'}</div>
        <div className="text-xl sm:text-2xl font-extrabold text-white mb-3">{data.title}</div>
        <div className="text-5xl tracking-widest mb-4">
          {[1, 2, 3].map((s) => (
            <motion.span key={s} initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2 + s * 0.18, type: 'spring' }} className={`inline-block ${s <= data.stars ? 'text-[#fbbf24] drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]' : 'text-[#26315a]'}`}>
              ★
            </motion.span>
          ))}
        </div>
        <div className="text-left rounded-xl bg-[#141c38] border border-[#26315a] p-4 text-sm text-[#e6eaf5] leading-relaxed prose-sd mb-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#34d399] mb-1">💡 Lo que aprendiste</div>
          <Rich text={data.lesson} />
        </div>
        <button onClick={onClose} className="w-full rounded-xl bg-[#22d3ee] text-[#04131a] font-bold py-3 hover:brightness-110 active:scale-[0.98] transition">
          Volver al reino
        </button>
      </motion.div>
    </motion.div>
  )
}

export function Codex({ onClose }: { onClose: () => void }) {
  useKey(['Escape'], onClose)
  const unlocked = useGame((s) => s.quest.codex)
  const ids = Object.keys(CODEX)
  const [sel, setSel] = useState<string | null>(unlocked[unlocked.length - 1] ?? null)
  const entry = sel ? CODEX[sel] : null
  const topic = entry ? topicById(entry.topic) : undefined
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-3">
      <motion.div initial={{ scale: 0.94 }} animate={{ scale: 1 }} className="w-full max-w-3xl max-h-full overflow-hidden rounded-2xl border-2 border-[#3b4a80] bg-[#0f1630] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#26315a]">
          <div>
            <div className="font-['Press_Start_2P'] text-xs text-[#22d3ee]">CÓDICE DEL ARQUITECTO</div>
            <div className="text-xs text-[#8f9bbd] mt-1">
              {unlocked.length}/{ids.length} saberes desbloqueados
            </div>
          </div>
          <button onClick={onClose} className="text-[#8f9bbd] hover:text-white p-1" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="grid sm:grid-cols-[15rem_1fr] min-h-0 flex-1 overflow-hidden">
          <div className="overflow-y-auto border-b sm:border-b-0 sm:border-r border-[#26315a] p-2 max-h-48 sm:max-h-none">
            {ids.map((id) => {
              const open = unlocked.includes(id)
              return (
                <button key={id} disabled={!open} onClick={() => setSel(id)} className={`w-full text-left rounded-lg px-3 py-2 text-sm flex gap-2 items-center ${sel === id ? 'bg-[#22d3ee]/15 text-white' : open ? 'text-[#c9d1e8] hover:bg-white/5' : 'text-[#4b5578]'}`}>
                  <span>{open ? CODEX[id].icon : '🔒'}</span>
                  <span className="truncate">{open ? CODEX[id].title : '???'}</span>
                </button>
              )
            })}
          </div>
          <div className="overflow-y-auto p-5">
            {entry ? (
              <>
                <div className="text-4xl mb-2">{entry.icon}</div>
                <div className="text-lg font-bold text-white mb-3">{entry.title}</div>
                <div className="text-[15px] text-[#e6eaf5] leading-relaxed prose-sd">
                  <Rich text={entry.text} />
                </div>
                {topic && (
                  <Link to={`/topic/${topic.id}`} className="inline-flex mt-5 rounded-xl border border-[#3b4a80] px-3 py-2 text-sm text-[#22d3ee] hover:border-[#22d3ee]">
                    {topic.icon} Profundiza en el curso: {topic.title} →
                  </Link>
                )}
              </>
            ) : (
              <div className="text-sm text-[#8f9bbd]">Supera pruebas y encuentra pergaminos para llenar el códice.</div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

const CAST = ['hero', 'ada', 'tomas', 'lia', 'rin', 'offset', 'paxi']

export function TitleScreen({ onStart, onReset }: { onStart: () => void; onReset: () => void }) {
  const quest = useGame((s) => s.quest)
  const [confirm, setConfirm] = useState(false)
  useKey(['Enter'], onStart)
  const pillars = PUZZLES.filter((p) => (quest.pillars[p] ?? 0) > 0).length
  const seals = TREASURY.filter((p) => (quest.pillars[p] ?? 0) > 0).length
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#2a2160_0%,#0b1020_60%)]">
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-6xl sm:text-7xl mb-4 drop-shadow-[0_0_24px_rgba(126,240,255,0.6)]">
          💎
        </motion.div>
        <h1 className="font-['Press_Start_2P'] text-3xl sm:text-5xl text-white tracking-wider drop-shadow-[0_4px_0_#3b2f7a]">NIMBUS</h1>
        <div className="font-['Press_Start_2P'] text-[10px] sm:text-xs text-[#22d3ee] mt-4 tracking-widest">EL REINO DISTRIBUIDO</div>
        <p className="text-[#c9d1e8] max-w-md mt-5 text-sm sm:text-base">Una aventura de System Design. Restaura los cinco pilares del reino resolviendo pruebas de balanceo, caché, hashing, colas y consenso… y enfrenta a la Horda del Viernes Negro. Prepara tu entrevista en el Distrito del Tesoro: idempotencia, hilos, incidentes, sagas, despliegues y liderazgo.</p>
        <div className="flex gap-1 sm:gap-2 mt-6 mb-6">
          {CAST.map((c, i) => (
            <motion.img key={c} src={portrait(c, 4)} alt="" className="w-12 sm:w-16 [image-rendering:pixelated]" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.12 }} />
          ))}
        </div>
        <button onClick={onStart} className="rounded-xl bg-[#22d3ee] text-[#04131a] font-['Press_Start_2P'] text-xs sm:text-sm px-8 py-4 hover:brightness-110 active:scale-95 transition shadow-[0_6px_0_#0e7490]">
          {quest.started ? '▶ CONTINUAR' : '▶ NUEVA PARTIDA'}
        </button>
        {quest.started && (
          <div className="text-xs text-[#8f9bbd] mt-3">
            Pilares: {pillars}/5 · Sellos del Tesoro: {seals}/6 · Pergaminos: {quest.scrolls.length}/{SCROLLS.length} {quest.bossStars > 0 ? '· 🐉 Horda derrotada' : ''}
          </div>
        )}
        <div className="mt-6 grid gap-1 text-xs text-[#8f9bbd]">
          <div>⌨️ Flechas / WASD para moverte · E / Espacio para interactuar</div>
          <div>📱 En el móvil: cruceta y botón Ⓐ · 🔊 Activa el sonido para la música</div>
        </div>
        <div className="flex flex-wrap gap-3 justify-center mt-6 text-sm">
          <Link to="/" className="text-[#8f9bbd] hover:text-white underline-offset-4 hover:underline">
            ← Volver al curso
          </Link>
          {quest.started &&
            (confirm ? (
              <span className="text-[#fca5a5]">
                ¿Borrar la partida?{' '}
                <button
                  className="underline font-bold"
                  onClick={() => {
                    onReset()
                    setConfirm(false)
                  }}
                >
                  Sí
                </button>{' '}
                ·{' '}
                <button className="underline" onClick={() => setConfirm(false)}>
                  No
                </button>
              </span>
            ) : (
              <button className="text-[#8f9bbd] hover:text-[#fca5a5]" onClick={() => setConfirm(true)}>
                Empezar de nuevo
              </button>
            ))}
        </div>
      </div>
    </motion.div>
  )
}
