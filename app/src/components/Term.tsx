import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BookOpen, GraduationCap } from 'lucide-react'
import { termById } from '@/data/glossary'
import { ARTICLES } from '@/data/articles'
import { topicById } from '@/data/topics'
import { Rich } from './Rich'

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

/** Término técnico con tooltip de explicación simple y enlace al artículo o tema. */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const t = termById(id)
  const ref = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), 120)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(false), 180)
  }

  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const place = () => {
      const r = ref.current!.getBoundingClientRect()
      const w = Math.min(300, window.innerWidth - 24)
      const h = tipRef.current?.offsetHeight ?? 160
      const above = r.bottom + h + 12 > window.innerHeight && r.top > h + 12
      const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12))
      setPos({ left, top: above ? r.top - h - 8 : r.bottom + 8, above })
    }
    place()
    const raf = requestAnimationFrame(place) // re-medir con la altura real del tooltip
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // En táctil: cerrar al tocar fuera
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !tipRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!t) return <>{children}</>
  const articleId = ARTICLES[t.id] ? t.id : t.see && ARTICLES[t.see] ? t.see : null
  const topic = t.topic ? topicById(t.topic) : undefined

  return (
    <>
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={`${t.term}: ver explicación`}
        onMouseEnter={() => canHover() && show()}
        onMouseLeave={() => canHover() && hide()}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="cursor-help underline decoration-dotted decoration-accent/70 underline-offset-[3px] decoration-[1.5px] hover:text-accent transition-colors"
      >
        {children ?? t.term}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={tipRef}
              role="tooltip"
              initial={{ opacity: 0, y: pos?.above ? 4 : -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              onMouseEnter={() => window.clearTimeout(timer.current)}
              onMouseLeave={() => canHover() && hide()}
              className="fixed z-[60] rounded-xl border border-accent/40 bg-surface shadow-2xl p-3.5 text-left"
              style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(300, typeof window !== 'undefined' ? window.innerWidth - 24 : 300) }}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold text-accent mb-0.5">{t.cat}</div>
              <div className="font-bold text-sm text-text mb-1">{t.term}</div>
              <div className="text-[13px] leading-relaxed text-muted prose-sd">
                <Rich text={t.short} />
              </div>
              {(articleId || topic) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {articleId && (
                    <Link to={`/glossary/${articleId}`} onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-accent text-[#04131a] px-2.5 py-1.5 hover:brightness-110">
                      <BookOpen size={13} /> {articleId === t.id ? 'Leer artículo' : 'Artículo relacionado'}
                    </Link>
                  )}
                  {topic && (
                    <Link to={`/topic/${topic.id}`} onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-border px-2.5 py-1.5 text-text hover:border-accent">
                      <GraduationCap size={13} /> Tema: {topic.title}
                    </Link>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
