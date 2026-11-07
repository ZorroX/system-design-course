/** Generador determinista (mulberry32) para simulaciones reproducibles. */
export function rng(seed = 42) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Muestreador Zipf: P(k) ∝ 1 / (k+1)^s para k en [0, n). */
export function zipf(n: number, s: number, rand: () => number = Math.random) {
  const weights = Array.from({ length: n }, (_, k) => 1 / Math.pow(k + 1, s))
  const total = weights.reduce((a, b) => a + b, 0)
  const cdf: number[] = []
  let acc = 0
  for (const w of weights) {
    acc += w / total
    cdf.push(acc)
  }
  return () => {
    const u = rand()
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cdf[mid] < u) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}

/** Poisson simple: número de llegadas en dt con tasa lambda. */
export function poisson(lambda: number, rand: () => number = Math.random) {
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(rand)))
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rand()
  } while (p > L)
  return k - 1
}

function gauss(rand: () => number) {
  const u = Math.max(1e-9, rand())
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** FNV-1a de 32 bits normalizado a [0,1). */
export function hash01(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // mezcla final (murmur fmix) para mejor dispersión
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
