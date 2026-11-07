import confetti from 'canvas-confetti'
import { useGame } from '@/store/game'

const COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6']

export function celebrate(size: 'small' | 'big' = 'small') {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  if (size === 'small') {
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 }, colors: COLORS, disableForReducedMotion: true })
    return
  }
  const end = Date.now() + 900
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors: COLORS })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors: COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

let ctx: AudioContext | null = null
/** Pequeños "blips" sintetizados (sin assets). Respeta el ajuste de sonido. */
export function blip(kind: 'good' | 'bad' | 'level' = 'good') {
  if (!useGame.getState().settings.sound) return
  try {
    ctx ??= new AudioContext()
    const notes = kind === 'good' ? [660, 880] : kind === 'bad' ? [300, 220] : [523, 659, 784, 1046]
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      o.type = 'triangle'
      o.frequency.value = f
      const t = ctx!.currentTime + i * 0.08
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
      o.connect(g).connect(ctx!.destination)
      o.start(t)
      o.stop(t + 0.16)
    })
  } catch {
    /* audio no disponible */
  }
}
