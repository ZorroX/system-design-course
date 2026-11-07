import { AnimatePresence, motion, Reorder } from 'motion/react'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, RotateCcw } from 'lucide-react'
import type { Question } from '@/data/types'
import { shuffle } from '@/lib/format'
import { Rich } from './Rich'
import { ProgressBar } from './ui'
import { blip, celebrate } from '@/lib/fx'

function isCorrect(q: Question, answer: number[] | null): boolean {
  if (!answer) return false
  if (q.kind === 'single') return answer[0] === q.answer
  if (q.kind === 'multi') return answer.length === q.answers.length && q.answers.every((a) => answer.includes(a))
  // order: answer = índices originales en el orden elegido; correcto si coinciden los textos
  return answer.every((idx, pos) => q.items[idx] === q.items[pos])
}

export function QuestionView({ q, onAnswered, seed = 1 }: { q: Question; onAnswered: (correct: boolean) => void; seed?: number }) {
  const [selected, setSelected] = useState<number[]>([])
  const initialOrder = useMemo(() => {
    if (q.kind !== 'order') return []
    let o = shuffle(q.items.map((_, i) => i), seed)
    // evita presentar el orden ya resuelto
    if (o.every((idx, pos) => q.items[idx] === q.items[pos])) o = [...o.slice(1), o[0]]
    return o
  }, [q, seed])
  const [order, setOrder] = useState<number[]>(initialOrder)
  const [submitted, setSubmitted] = useState(false)

  const answer = q.kind === 'order' ? order : selected
  const correct = submitted && isCorrect(q, answer)

  const submit = () => {
    if (submitted) return
    setSubmitted(true)
    const ok = isCorrect(q, answer)
    blip(ok ? 'good' : 'bad')
    onAnswered(ok)
  }

  const toggle = (i: number) => {
    if (submitted) return
    if (q.kind === 'single') setSelected([i])
    else setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  }

  const move = (pos: number, dir: -1 | 1) => {
    const next = [...order]
    const j = pos + dir
    if (j < 0 || j >= next.length) return
    ;[next[pos], next[j]] = [next[j], next[pos]]
    setOrder(next)
  }

  return (
    <div>
      <div className="text-base sm:text-lg font-semibold mb-1 leading-snug">
        <Rich text={q.q} />
      </div>
      <div className="text-xs text-muted mb-4">
        {q.kind === 'single' ? 'Elige una' : q.kind === 'multi' ? 'Elige todas las correctas' : 'Arrastra o usa las flechas para ordenar'}
      </div>

      {q.kind !== 'order' && (
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const isSel = selected.includes(i)
            const isRight = q.kind === 'single' ? q.answer === i : q.answers.includes(i)
            let cls = 'border-border bg-surface-2 hover:border-accent/60'
            if (isSel && !submitted) cls = 'border-accent bg-accent/10'
            if (submitted && isRight) cls = 'border-good bg-good/10'
            if (submitted && isSel && !isRight) cls = 'border-bad bg-bad/10'
            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggle(i)}
                className={`text-left rounded-xl border px-4 py-3 text-sm transition-colors flex gap-3 items-start ${cls}`}
              >
                <span className={`mt-0.5 shrink-0 w-5 h-5 ${q.kind === 'single' ? 'rounded-full' : 'rounded-md'} border-2 flex items-center justify-center text-[10px] font-bold ${isSel ? 'border-accent bg-accent text-[#04131a]' : 'border-muted/50'}`}>
                  {isSel ? '✓' : String.fromCharCode(65 + i)}
                </span>
                <span>
                  <Rich text={opt} />
                </span>
              </motion.button>
            )
          })}
        </div>
      )}

      {q.kind === 'order' && (
        <Reorder.Group axis="y" values={order} onReorder={submitted ? () => {} : setOrder} className="grid gap-2">
          {order.map((idx, pos) => {
            const ok = submitted && q.items[idx] === q.items[pos]
            return (
              <Reorder.Item
                key={idx}
                value={idx}
                dragListener={!submitted}
                className={`rounded-xl border px-3 py-2.5 text-sm flex items-center gap-2 bg-surface-2 select-none touch-none ${submitted ? (ok ? 'border-good bg-good/10' : 'border-bad bg-bad/10') : 'border-border cursor-grab active:cursor-grabbing'}`}
              >
                <GripVertical size={16} className="text-muted shrink-0" />
                <span className="w-5 text-muted font-mono text-xs">{pos + 1}.</span>
                <span className="flex-1">
                  <Rich text={q.items[idx]} />
                </span>
                {!submitted && (
                  <span className="flex gap-1">
                    <button className="p-1 rounded hover:bg-surface" onClick={() => move(pos, -1)} aria-label="Subir">
                      <ArrowUp size={14} />
                    </button>
                    <button className="p-1 rounded hover:bg-surface" onClick={() => move(pos, 1)} aria-label="Bajar">
                      <ArrowDown size={14} />
                    </button>
                  </span>
                )}
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
      )}

      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 rounded-xl px-4 py-3 text-sm border ${correct ? 'border-good/40 bg-good/10' : 'border-bad/40 bg-bad/10'}`}
          >
            <div className="font-bold mb-1">{correct ? '✅ ¡Correcto!' : '❌ No exactamente'}</div>
            {!correct && q.kind === 'order' && (
              <div className="mb-1 text-muted">
                Orden correcto: {q.items.map((it, i) => `${i + 1}. ${it}`).join(' → ')}
              </div>
            )}
            <div className="text-muted">
              <Rich text={q.explain} auto />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!submitted && (
        <button className="btn btn-primary mt-4 w-full sm:w-auto" disabled={q.kind !== 'order' && selected.length === 0} onClick={submit}>
          Comprobar
        </button>
      )}
    </div>
  )
}

export function Quiz({ questions, onFinish, best }: { questions: Question[]; onFinish: (pct: number) => void; best?: number }) {
  const [i, setI] = useState(0)
  const [answered, setAnswered] = useState<boolean | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)
  const [attempt, setAttempt] = useState(1)

  const handle = (ok: boolean) => {
    setAnswered(ok)
    if (ok) setCorrectCount((c) => c + 1)
  }

  const next = () => {
    if (i + 1 >= questions.length) {
      const pct = Math.round((correctCount / questions.length) * 100)
      setDone(true)
      onFinish(pct)
      if (pct >= 70) celebrate(pct === 100 ? 'big' : 'small')
      return
    }
    setI(i + 1)
    setAnswered(null)
  }

  const restart = () => {
    setI(0)
    setAnswered(null)
    setCorrectCount(0)
    setDone(false)
    setAttempt((a) => a + 1)
  }

  if (done) {
    const pct = Math.round((correctCount / questions.length) * 100)
    return (
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
        <div className="text-6xl mb-2">{pct === 100 ? '🏆' : pct >= 70 ? '🎉' : '📚'}</div>
        <div className="text-3xl font-extrabold">{pct}%</div>
        <div className="text-muted mt-1">
          {correctCount} de {questions.length} correctas · {pct >= 70 ? 'Tema completado' : 'Necesitas 70% para completar el tema'}
        </div>
        {best !== undefined && <div className="text-xs text-muted mt-1">Mejor marca: {Math.max(best, pct)}%</div>}
        <button className="btn btn-ghost mt-5" onClick={restart}>
          <RotateCcw size={16} /> Reintentar
        </button>
      </motion.div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <ProgressBar value={(i + (answered !== null ? 1 : 0)) / questions.length} />
        <span className="text-xs text-muted tabular-nums shrink-0">
          {i + 1}/{questions.length}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={`${attempt}-${i}`} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.2 }}>
          <QuestionView q={questions[i]} onAnswered={handle} seed={attempt * 97 + i} />
        </motion.div>
      </AnimatePresence>
      {answered !== null && (
        <button className="btn btn-primary mt-4 w-full sm:w-auto" onClick={next}>
          {i + 1 >= questions.length ? 'Ver resultado' : 'Siguiente →'}
        </button>
      )}
    </div>
  )
}
