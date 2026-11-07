import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useToasts } from '@/store/game'
import { blip, celebrate } from '@/lib/fx'

export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  const seen = useRef(new Set<number>())

  useEffect(() => {
    for (const t of toasts) {
      if (seen.current.has(t.id)) continue
      seen.current.add(t.id)
      if (t.kind === 'achievement') {
        celebrate('small')
        blip('level')
      }
      if (t.kind === 'level') {
        celebrate('big')
        blip('level')
      }
    }
  }, [toasts])

  return (
    <div className="fixed z-50 top-3 right-3 left-3 sm:left-auto sm:w-80 grid gap-2 pointer-events-none" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60 }}
            className={`pointer-events-auto text-left rounded-2xl border shadow-xl px-4 py-3 backdrop-blur ${
              t.kind === 'xp' ? 'bg-surface/95 border-border' : t.kind === 'level' ? 'bg-violet/20 border-violet' : 'bg-warn/15 border-warn/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.kind === 'xp' ? '✨' : t.kind === 'level' ? '🚀' : t.icon}</span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted">{t.kind === 'xp' ? 'Experiencia' : t.kind === 'level' ? 'Subiste de nivel' : 'Logro desbloqueado'}</div>
                <div className="font-bold">{t.title}</div>
                {t.text && <div className="text-xs text-muted truncate">{t.text}</div>}
              </div>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
