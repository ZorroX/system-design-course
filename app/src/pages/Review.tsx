import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { ALL_FLASHCARDS, topicById } from '@/data/topics'
import { useGame } from '@/store/game'
import { Card, Empty, ProgressBar, SectionTitle } from '@/components/ui'
import { Rich } from '@/components/Rich'
import { celebrate } from '@/lib/fx'

const GRADES = [
  { g: 0 as const, label: 'Otra vez', sub: '< 1 min', cls: 'border-bad/50 hover:bg-bad/10' },
  { g: 3 as const, label: 'Difícil', sub: '', cls: 'border-warn/50 hover:bg-warn/10' },
  { g: 4 as const, label: 'Bien', sub: '', cls: 'border-good/50 hover:bg-good/10' },
  { g: 5 as const, label: 'Fácil', sub: '', cls: 'border-accent/50 hover:bg-accent/10' },
]

export default function Review() {
  const cards = useGame((s) => s.cards)
  const topics = useGame((s) => s.topics)
  const review = useGame((s) => s.reviewCard)
  const [ahead, setAhead] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [sessionDone, setSessionDone] = useState(0)

  // Prioriza tarjetas de temas que ya leíste; luego el resto.
  const queue = useMemo(() => {
    const now = Date.now()
    const list = ALL_FLASHCARDS.filter((c) => ahead || (cards[c.id]?.due ?? 0) <= now)
    return list.sort((a, b) => {
      const ra = topics[a.topicId]?.read ? 0 : 1
      const rb = topics[b.topicId]?.read ? 0 : 1
      return ra - rb || (cards[a.id]?.due ?? 0) - (cards[b.id]?.due ?? 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahead, sessionDone])

  const current = queue[0]
  const total = sessionDone + queue.length
  const learned = ALL_FLASHCARDS.filter((c) => (cards[c.id]?.interval ?? 0) >= 3).length

  const grade = (g: 0 | 3 | 4 | 5) => {
    review(current.id, g)
    setFlipped(false)
    setSessionDone((n) => n + 1)
    if (queue.length === 1) celebrate('small')
  }

  return (
    <div className="grid gap-6 max-w-2xl mx-auto">
      <SectionTitle sub="Repetición espaciada (algoritmo SM-2, como Anki): lo que te cuesta vuelve antes; lo que dominas, después.">🧠 Repaso</SectionTitle>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Card className="p-3">
          <div className="text-2xl font-extrabold">{queue.length}</div>
          <div className="text-xs text-muted">pendientes</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-extrabold text-good">{learned}</div>
          <div className="text-xs text-muted">consolidadas</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-extrabold">{ALL_FLASHCARDS.length}</div>
          <div className="text-xs text-muted">total</div>
        </Card>
      </div>

      {current ? (
        <>
          <ProgressBar value={total ? sessionDone / total : 0} color="var(--good)" />
          <div className="[perspective:1200px]">
            <motion.div
              className="relative h-72 cursor-pointer [transform-style:preserve-3d]"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              onClick={() => setFlipped((f) => !f)}
            >
              <div className="absolute inset-0 card p-6 flex flex-col items-center justify-center text-center [backface-visibility:hidden]">
                <div className="text-xs text-muted mb-3">
                  {topicById(current.topicId)?.icon} {topicById(current.topicId)?.title}
                </div>
                <div className="text-xl sm:text-2xl font-bold">{current.front}</div>
                <div className="text-xs text-muted mt-6">Toca para ver la respuesta</div>
              </div>
              <div className="absolute inset-0 card p-6 flex items-center justify-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)] border-good/50">
                <div className="text-base sm:text-lg leading-relaxed">
                  <Rich text={current.back} auto />
                </div>
              </div>
            </motion.div>
          </div>
          <AnimatePresence>
            {flipped && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button key={g.g} onClick={() => grade(g.g)} className={`btn btn-ghost flex-col !gap-0 ${g.cls}`}>
                    <span>{g.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <Card className="p-2">
          <Empty icon="🎉" title="¡Al día!">
            No tienes tarjetas pendientes. Vuelven automáticamente cuando toca repasarlas.
            <div className="mt-4">
              <button className="btn btn-ghost" onClick={() => setAhead(true)}>
                Practicar todas igualmente
              </button>
            </div>
          </Empty>
        </Card>
      )}
    </div>
  )
}
