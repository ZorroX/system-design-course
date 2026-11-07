/**
 * La Pajarera del Canario — despliegues canary: subir el tráfico por pasos, mirar métricas
 * y hacer rollback a tiempo (nivel 1 manual) o configurar el análisis automático (nivel 2,
 * como Argo Rollouts / Flagger / CodeDeploy).
 */
import { makeRng } from './rng.ts'

export const STEPS = [1, 5, 25, 50, 100]
export const TOTAL_RPS = 2000
export const BASE_ERR = 0.5 // %
export const BASE_P99 = 220 // ms

export interface Release {
  version: string
  note: string
  errDelta: number // puntos porcentuales extra de error
  latDelta: number // ms extra de p99
  /** fracción de peticiones del canary que sufren (errores + timeouts) */
  harm: number
  good: boolean
}

export const L1_RELEASES: Release[] = [
  { version: 'v2.1', note: 'Nuevo diseño del recibo', errDelta: 0, latDelta: 0, harm: 0, good: true },
  { version: 'v2.2', note: 'Cliente HTTP nuevo para el adquirente', errDelta: 4, latDelta: 0, harm: 0.04, good: false },
  { version: 'v2.3', note: 'Consulta de comisiones reescrita', errDelta: 0, latDelta: 230, harm: 0.03, good: false },
]

export const L2_RELEASES: Release[] = [
  { version: 'v3.0', note: 'Refactor de logs', errDelta: 0, latDelta: 0, harm: 0, good: true },
  { version: 'v3.1', note: 'Nuevo serializador', errDelta: 3, latDelta: 0, harm: 0.03, good: false },
  { version: 'v3.2', note: 'Más validaciones (algo más lenta)', errDelta: 0.15, latDelta: 25, harm: 0, good: true },
  { version: 'v3.3', note: 'ORM actualizado', errDelta: 0, latDelta: 150, harm: 0.02, good: false },
  { version: 'v3.4', note: 'Traducciones', errDelta: 0, latDelta: 0, harm: 0, good: true },
  { version: 'v3.5', note: 'Reintentos agresivos', errDelta: 1.2, latDelta: 0, harm: 0.012, good: false },
]

export interface Point {
  t: number
  cErr: number
  sErr: number
  cP99: number
  sP99: number
}

/** Un despliegue canary de una versión. */
export class Canary {
  time = 0
  step = 0
  status: 'running' | 'promoted' | 'rolledback' = 'running'
  harm = 0
  history: Point[] = []
  stepStart = 0
  private rnd: () => number
  rel: Release

  constructor(rel: Release, seed: number) {
    this.rel = rel
    this.rnd = makeRng(seed)
  }

  get share() {
    return this.status === 'rolledback' ? 0 : this.status === 'promoted' ? 100 : STEPS[this.step]
  }

  private gauss() {
    const u = Math.max(1e-9, this.rnd())
    const v = this.rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  /** Avanza 1 segundo */
  tick() {
    const share = this.share
    const nC = (TOTAL_RPS * share) / 100
    const nS = TOTAL_RPS - nC
    const pC = (BASE_ERR + this.rel.errDelta) / 100
    const pS = BASE_ERR / 100
    const errOf = (p: number, n: number) => {
      if (n <= 0) return NaN
      const k = Math.round(n)
      // binomial exacta para muestras chicas (sin sesgo); aproximación normal para muestras grandes
      if (k <= 300) {
        let e = 0
        for (let i = 0; i < k; i++) if (this.rnd() < p) e++
        return (e / k) * 100
      }
      return Math.max(0, (p + this.gauss() * Math.sqrt((p * (1 - p)) / k)) * 100)
    }
    const p99Of = (base: number, n: number) => (n <= 0 ? NaN : Math.max(80, base + this.gauss() * 60 * Math.sqrt(20 / Math.max(20, n))))
    this.history.push({
      t: this.time,
      cErr: errOf(pC, nC),
      sErr: errOf(pS, Math.max(nS, 1)),
      cP99: p99Of(BASE_P99 + this.rel.latDelta, nC),
      sP99: p99Of(BASE_P99, Math.max(nS, 1)),
    })
    this.harm += nC * this.rel.harm
    this.time += 1
  }

  advance() {
    if (this.status !== 'running') return
    if (this.step >= STEPS.length - 2) this.status = 'promoted'
    else this.step++
    this.stepStart = this.time
  }

  rollback() {
    if (this.status === 'running') this.status = 'rolledback'
  }

  /** Media de los últimos `secs` segundos del paso actual */
  window(secs: number) {
    const pts = this.history.filter((p) => p.t >= this.stepStart && p.t >= this.time - secs && !Number.isNaN(p.cErr))
    const avg = (f: (p: Point) => number) => (pts.length ? pts.reduce((a, p) => a + f(p), 0) / pts.length : NaN)
    return { n: pts.length, cErr: avg((p) => p.cErr), sErr: avg((p) => p.sErr), cP99: avg((p) => p.cP99), sP99: avg((p) => p.sP99) }
  }
}

/* ---------------- Nivel 1 ---------------- */
export const L1_HARM_BUDGET = 600
export function l1Stars(harm: number) {
  return harm <= 150 ? 3 : harm <= 350 ? 2 : 1
}

/* ---------------- Nivel 2: análisis automático ---------------- */
export const ERR_THRESHOLDS = [0.25, 0.5, 1, 2, 4]
export const LAT_THRESHOLDS = [25, 50, 100, 200, 400]
export const BAKE_TIMES = [5, 15, 30, 60]
export const L2_TIME_BUDGET = 700

export interface AutoPolicy {
  errThr: number
  latThr: number
  bake: number
}

export interface AutoOutcome {
  version: string
  good: boolean
  result: 'promoted' | 'rolledback'
  reason: string
  seconds: number
  harm: number
  verdict: 'ok' | 'false-rollback' | 'escaped'
}

export function runAuto(rel: Release, p: AutoPolicy, seed: number): { outcome: AutoOutcome; canary: Canary } {
  const c = new Canary(rel, seed)
  let reason = 'Métricas dentro de los umbrales en todos los pasos'
  while (c.status === 'running') {
    for (let i = 0; i < p.bake; i++) c.tick()
    const w = c.window(p.bake)
    const dErr = w.cErr - w.sErr
    const dLat = w.cP99 - w.sP99
    if (dErr > p.errThr) {
      reason = `Al ${c.share}%: error +${dErr.toFixed(2)} pts (umbral ${p.errThr})`
      c.rollback()
    } else if (dLat > p.latThr) {
      reason = `Al ${c.share}%: p99 +${Math.round(dLat)} ms (umbral ${p.latThr})`
      c.rollback()
    } else c.advance()
  }
  // una versión mala promovida sigue dañando hasta que alguien lo note (60 s al 100%)
  if (c.status === 'promoted' && !rel.good) for (let i = 0; i < 60; i++) c.tick()
  const result = c.status as 'promoted' | 'rolledback'
  const verdict = rel.good ? (result === 'promoted' ? 'ok' : 'false-rollback') : result === 'rolledback' ? 'ok' : 'escaped'
  return { outcome: { version: rel.version, good: rel.good, result, reason, seconds: c.time, harm: Math.round(c.harm), verdict }, canary: c }
}

export interface AutoSummary {
  outcomes: AutoOutcome[]
  seconds: number
  harm: number
  escaped: number
  falseRollbacks: number
  stars: number
  msg: string
}

export function runAutoAll(p: AutoPolicy): AutoSummary {
  const outcomes = L2_RELEASES.map((r, i) => runAuto(r, p, 100 + i * 17).outcome)
  const seconds = outcomes.reduce((a, o) => a + o.seconds, 0)
  const harm = outcomes.reduce((a, o) => a + o.harm, 0)
  const escaped = outcomes.filter((o) => o.verdict === 'escaped').length
  const falseRollbacks = outcomes.filter((o) => o.verdict === 'false-rollback').length
  let stars = 0
  let msg: string
  if (escaped) msg = `${escaped} versión(es) defectuosa(s) llegaron al 100% del tráfico. Umbrales demasiado permisivos o tiempo de observación muy corto para ver la diferencia entre el ruido y el fallo.`
  else if (falseRollbacks > 1) msg = `${falseRollbacks} rollbacks de versiones sanas: umbrales tan estrictos que el ruido normal dispara la alarma (y el equipo deja de confiar en el sistema).`
  else if (seconds > L2_TIME_BUDGET * 1.6) msg = `Nada se escapó, pero tardaste ${seconds} s en total (presupuesto ${L2_TIME_BUDGET} s). Esperar demasiado en cada paso frena las entregas.`
  else {
    stars = falseRollbacks === 0 && seconds <= L2_TIME_BUDGET ? 3 : 2
    msg =
      stars === 3
        ? `¡Pipeline de despliegue seguro! Ninguna versión mala llegó a producción completa, ningún rollback innecesario y ${seconds} s en total.`
        : falseRollbacks
          ? `Bien, pero hubo 1 rollback innecesario. Afina los umbrales para que el ruido normal no los dispare.`
          : `Bien, pero tardaste ${seconds} s (presupuesto ${L2_TIME_BUDGET} s). Prueba un tiempo de observación más corto.`
  }
  return { outcomes, seconds, harm, escaped, falseRollbacks, stars, msg }
}
