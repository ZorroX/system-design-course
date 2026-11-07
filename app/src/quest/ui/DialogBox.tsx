import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Rich } from '@/components/Rich'
import { portrait } from '../art'
import { chip } from '../audio'
import type { DialogScript } from '../bus'

/** Texto plano para el efecto máquina de escribir (sin marcado). */
const plain = (s: string) => s.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')

export function DialogBox({ script, onDone }: { script: DialogScript; onDone: (choice: number) => void }) {
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(0)
  const [choice, setChoice] = useState(0)
  const line = script.lines[i]
  const text = plain(line.text)
  const typing = shown < text.length
  const last = i === script.lines.length - 1
  const hasChoices = last && !!script.choices?.length && !typing
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setShown(0)
    setChoice(0)
  }, [i, script])

  useEffect(() => {
    if (!typing) return
    timer.current = window.setTimeout(() => {
      setShown((s) => Math.min(text.length, s + 2))
      if (shown % 6 === 0) chip.sfx('talk')
    }, 18)
    return () => window.clearTimeout(timer.current)
  }, [shown, typing, text.length])

  const advance = useCallback(() => {
    if (typing) return setShown(text.length)
    if (hasChoices) return onDone(choice)
    if (!last) return setI((x) => x + 1)
    onDone(0)
  }, [typing, text.length, hasChoices, last, choice, onDone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hasChoices && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'w' || e.key === 's')) {
        e.preventDefault()
        setChoice((c) => (c + (e.key === 'ArrowDown' || e.key === 's' ? 1 : -1) + script.choices!.length) % script.choices!.length)
        return
      }
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, hasChoices, script.choices])

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      className="absolute inset-x-3 bottom-3 sm:bottom-6 mx-auto max-w-3xl z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="rounded-2xl border-2 border-[#3b4a80] bg-[#0f1630]/95 backdrop-blur shadow-2xl p-4 sm:p-5 flex gap-4 cursor-pointer select-none" onClick={() => !hasChoices && advance()}>
        {line.portrait && (
          <div className="shrink-0 w-16 h-14 sm:w-20 sm:h-16 rounded-xl bg-[#1b2547] border border-[#3b4a80] overflow-hidden flex items-end justify-center">
            <img src={portrait(line.portrait)} alt="" className="w-full [image-rendering:pixelated]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-['Press_Start_2P'] text-[10px] sm:text-xs text-[#22d3ee] mb-2">{line.who}</div>
          <div className="text-[15px] sm:text-base leading-relaxed text-[#e6eaf5] prose-sd min-h-[3.2rem]">{typing ? text.slice(0, shown) : <Rich text={line.text} />}</div>
          {hasChoices && (
            <div className="mt-3 grid gap-2">
              {script.choices!.map((c, k) => (
                <button
                  key={c}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDone(k)
                  }}
                  onMouseEnter={() => setChoice(k)}
                  className={`text-left rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${choice === k ? 'border-[#22d3ee] bg-[#22d3ee]/15 text-white' : 'border-[#3b4a80] text-[#c9d1e8]'}`}
                >
                  {choice === k ? '▶ ' : ''}
                  {c}
                </button>
              ))}
            </div>
          )}
          {!hasChoices && <div className="text-right text-[11px] text-[#8f9bbd] mt-1 animate-pulse">{typing ? '' : last ? 'Cerrar ▸' : 'Siguiente ▸'}</div>}
        </div>
      </div>
    </motion.div>
  )
}
