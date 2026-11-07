import { useEffect, useRef, useState } from 'react'
import { useGame } from '@/store/game'

/** Ejecuta cb cada `ms` mientras running sea true. cb siempre ve el estado más reciente. */
export function useInterval(cb: () => void, ms: number, running = true) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => ref.current(), ms)
    return () => clearInterval(id)
  }, [ms, running])
}

/** Fuerza re-render (para motores de simulación que viven en refs). */
export function useForceRender() {
  const [, set] = useState(0)
  return () => set((x) => (x + 1) % 1_000_000)
}

export interface ThemeColors {
  accent: string
  violet: string
  good: string
  warn: string
  bad: string
  pink: string
  muted: string
  border: string
  surface: string
  text: string
}

/** Colores reales (hex) del tema actual, para librerías que no entienden var(--x). */
export function useColors(): ThemeColors {
  const theme = useGame((s) => s.settings.theme)
  const read = (): ThemeColors => {
    const cs = getComputedStyle(document.documentElement)
    const g = (n: string) => cs.getPropertyValue(`--${n}`).trim()
    return { accent: g('accent'), violet: g('violet'), good: g('good'), warn: g('warn'), bad: g('bad'), pink: g('pink'), muted: g('muted'), border: g('border'), surface: g('surface'), text: g('text') }
  }
  const [c, setC] = useState<ThemeColors>(read)
  useEffect(() => {
    const id = requestAnimationFrame(() => setC(read()))
    return () => cancelAnimationFrame(id)
  }, [theme])
  return c
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}
