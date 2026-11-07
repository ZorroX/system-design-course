export function fmt(n: number, digits = 1): string {
  const abs = Math.abs(n)
  if (abs >= 1e12) return (n / 1e12).toFixed(digits).replace(/\.0$/, '') + 'T'
  if (abs >= 1e9) return (n / 1e9).toFixed(digits).replace(/\.0$/, '') + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(digits).replace(/\.0$/, '') + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(digits).replace(/\.0$/, '') + 'k'
  return Number.isInteger(n) ? String(n) : n.toFixed(digits)
}

export function fmtBytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  let i = 0
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `${n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '')} ${units[i]}`
}

export function fmtMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + ' s'
  if (ms >= 10) return Math.round(ms) + ' ms'
  return ms.toFixed(1) + ' ms'
}

export function dayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = [...arr]
  let s = seed ?? Math.floor(Math.random() * 1e9)
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
