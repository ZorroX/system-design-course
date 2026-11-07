/**
 * La Forja de Hilos — configuración de un ThreadPoolExecutor de Java.
 * Simulación discreta (pasos de 5 ms) con la misma semántica que ThreadPoolExecutor:
 *   1) si hay menos de `core` hilos → se crea un hilo nuevo
 *   2) si no, se intenta encolar
 *   3) si la cola está llena y hay menos de `max` hilos → se crea un hilo extra
 *   4) si no → política de rechazo (Abort / CallerRuns / Discard)
 * La CPU se reparte entre los hilos que están calculando; con más hilos ejecutables que núcleos
 * hay sobrecosto por cambios de contexto. Es la misma simulación que usa el curso (ThreadPoolSim).
 */
import { makeRng } from './rng.ts'

export type Policy = 'abort' | 'caller' | 'discard'
export const POLICY_LABEL: Record<Policy, string> = { abort: 'AbortPolicy', caller: 'CallerRunsPolicy', discard: 'DiscardPolicy' }

export interface PoolConfig {
  core: number
  max: number
  /** capacidad de la cola; Infinity = LinkedBlockingQueue sin límite */
  queue: number
  policy: Policy
}

export interface Workload {
  id: string
  title: string
  story: string
  cores: number
  cpuMs: number
  waitMs: number
  /** peticiones por segundo en el instante t */
  rate: (t: number) => number
  duration: number
  heapMb: number
  baseMb: number
  itemMb: number
  stackMb: number
  goal: { p99: number; rejectPct: number }
  /** para 3 estrellas */
  ideal: (c: PoolConfig) => boolean
  idealHint: string
}

export const QUEUE_STEPS = [0, 10, 50, 100, 200, 500, 1000, Infinity]
export const queueLabel = (q: number) => (q === Infinity ? '∞ (sin límite)' : q === 0 ? '0 (SynchronousQueue)' : String(q))

export const WORKLOADS: Workload[] = [
  {
    id: 'io',
    title: 'Cobros con el adquirente (I/O)',
    story: 'Cada cobro usa ~8 ms de CPU y espera ~92 ms la respuesta del banco adquirente. 4 núcleos. Hay un pico al doble de tráfico entre los segundos 4 y 8.',
    cores: 4,
    cpuMs: 8,
    waitMs: 92,
    rate: (t) => (t >= 4 && t < 8 ? 380 : 190),
    duration: 12,
    heapMb: 512,
    baseMb: 160,
    itemMb: 0.25,
    stackMb: 1,
    goal: { p99: 400, rejectPct: 1 },
    ideal: (c) => c.queue !== Infinity && c.max <= 100,
    idealHint: 'Para 3★: cola acotada y como mucho 100 hilos (cada hilo reserva ~1 MB de stack).',
  },
  {
    id: 'cpu',
    title: 'Motor de riesgo (CPU)',
    story: 'Cada evaluación antifraude calcula 30 ms de CPU pura (casi sin esperas). 4 núcleos: la capacidad máxima es ~133 por segundo. Pico de 200/s entre los segundos 3 y 5.',
    cores: 4,
    cpuMs: 30,
    waitMs: 1,
    rate: (t) => (t >= 3 && t < 5 ? 200 : 105),
    duration: 12,
    heapMb: 512,
    baseMb: 160,
    itemMb: 0.25,
    stackMb: 1,
    goal: { p99: 1300, rejectPct: 3 },
    ideal: (c) => c.queue !== Infinity && c.max <= 6,
    idealHint: 'Para 3★: cola acotada y no más de núcleos + 2 hilos (más hilos de CPU solo agregan cambios de contexto).',
  },
]

interface Task {
  arrive: number
  cpuLeft: number
  waitLeft: number
}
interface Worker {
  task: Task | null
  idleSince: number
  core: boolean
}

export interface Sample {
  t: number
  threads: number
  busy: number
  queue: number
  memMb: number
  doneRate: number
  rejected: number
}

export interface ForgeResult {
  completed: number
  rejected: number
  rejectPct: number
  p50: number
  p99: number
  peakThreads: number
  peakQueue: number
  peakMem: number
  oom: boolean
  cpuUtil: number
  pass: boolean
  stars: number
  msg: string
}

const DT = 0.005
const KEEP_ALIVE = 1

/** Simulación paso a paso (para animarla) */
export class ForgeSim {
  time = 0
  workers: Worker[] = []
  queue: Task[] = []
  backlog: number[] = [] // llegadas esperando a que el hilo que acepta quede libre (CallerRuns)
  caller: Task | null = null
  latencies: number[] = []
  rejected = 0
  arrived = 0
  oom = false
  peakThreads = 0
  peakQueue = 0
  peakMem = 0
  cpuBusy = 0
  samples: Sample[] = []
  events: { type: 'reject' | 'done' | 'spawn' | 'oom' }[] = []
  private acc = 0
  private rnd: () => number
  private doneWindow: number[] = []
  private sampleAcc = 0
  private rejectedAtSample = 0

  cfg: PoolConfig
  w: Workload

  constructor(cfg: PoolConfig, w: Workload, seed = 7) {
    this.cfg = cfg
    this.w = w
    this.rnd = makeRng(seed)
  }

  get finished() {
    return this.oom || (this.time >= this.w.duration && this.queue.length === 0 && this.backlog.length === 0 && !this.caller && this.workers.every((x) => !x.task)) || this.time > this.w.duration + 20
  }

  memMb() {
    return this.w.baseMb + this.workers.length * this.w.stackMb + this.queue.length * this.w.itemMb
  }

  private newTask(arrive: number): Task {
    const j = () => 0.7 + this.rnd() * 0.6
    return { arrive, cpuLeft: this.w.cpuMs * j(), waitLeft: this.w.waitMs * j() }
  }

  private submit(task: Task): boolean {
    const c = this.cfg
    if (this.workers.length < c.core) {
      this.workers.push({ task, idleSince: 0, core: true })
      this.events.push({ type: 'spawn' })
      return true
    }
    const idle = this.workers.find((x) => !x.task)
    if (idle && this.queue.length === 0) {
      idle.task = task
      return true
    }
    if (this.queue.length < c.queue) {
      this.queue.push(task)
      return true
    }
    if (this.workers.length < c.max) {
      this.workers.push({ task, idleSince: 0, core: false })
      this.events.push({ type: 'spawn' })
      return true
    }
    // rechazo
    if (c.policy === 'caller') {
      this.caller = task
      return true
    }
    this.rejected++
    this.events.push({ type: 'reject' })
    return false
  }

  step(dtSec: number) {
    this.acc += dtSec
    while (this.acc >= DT && !this.oom) {
      this.acc -= DT
      this.tick()
    }
  }

  private tick() {
    const t = this.time
    const w = this.w
    // llegadas (Poisson aproximado con Bernoulli por paso)
    if (t < w.duration) {
      const lam = w.rate(t) * DT
      let n = Math.floor(lam)
      if (this.rnd() < lam - n) n++
      for (let i = 0; i < n; i++) {
        this.arrived++
        this.backlog.push(t)
      }
    }
    // el hilo que acepta peticiones solo puede enviar si no está ejecutando una tarea por CallerRuns
    while (this.backlog.length && !this.caller) {
      const at = this.backlog.shift()!
      this.submit(this.newTask(at))
    }
    // CPU: hilos en fase de cálculo
    const computing = this.workers.filter((x) => x.task && x.task.cpuLeft > 0).map((x) => x.task!)
    if (this.caller && this.caller.cpuLeft > 0) computing.push(this.caller)
    const n = computing.length
    if (n > 0) {
      const share = Math.min(1, w.cores / n)
      const overhead = 1 + 0.006 * Math.max(0, n - w.cores)
      const ms = (DT * 1000 * share) / overhead
      for (const k of computing) k.cpuLeft -= ms
      this.cpuBusy += Math.min(n, w.cores) * DT
    }
    // esperas de I/O (no usan CPU)
    const all = this.workers.map((x) => x.task)
    if (this.caller) all.push(this.caller)
    for (const k of all) if (k && k.cpuLeft <= 0 && k.waitLeft > 0) k.waitLeft -= DT * 1000
    // terminar tareas
    const now = t + DT
    for (const wk of this.workers) {
      if (wk.task && wk.task.cpuLeft <= 0 && wk.task.waitLeft <= 0) {
        this.finish(wk.task, now)
        wk.task = this.queue.shift() ?? null
        if (!wk.task) wk.idleSince = now
      }
    }
    if (this.caller && this.caller.cpuLeft <= 0 && this.caller.waitLeft <= 0) {
      this.finish(this.caller, now)
      this.caller = null
    }
    // hilos extra ociosos mueren tras keepAlive
    this.workers = this.workers.filter((wk) => wk.task || wk.core || now - wk.idleSince < KEEP_ALIVE)
    this.time = now
    this.peakThreads = Math.max(this.peakThreads, this.workers.length)
    this.peakQueue = Math.max(this.peakQueue, this.queue.length)
    const mem = this.memMb()
    this.peakMem = Math.max(this.peakMem, mem)
    if (mem > w.heapMb) {
      this.oom = true
      this.events.push({ type: 'oom' })
    }
    // muestras cada 0,25 s
    this.sampleAcc += DT
    if (this.sampleAcc >= 0.25 - 1e-9) {
      this.sampleAcc = 0
      this.doneWindow = this.doneWindow.filter((x) => x > now - 1)
      this.samples.push({
        t: Math.round(now * 100) / 100,
        threads: this.workers.length,
        busy: this.workers.filter((x) => x.task).length,
        queue: this.queue.length,
        memMb: Math.round(mem),
        doneRate: this.doneWindow.length,
        rejected: this.rejected - this.rejectedAtSample,
      })
      this.rejectedAtSample = this.rejected
    }
  }

  private finish(task: Task, now: number) {
    this.latencies.push((now - task.arrive) * 1000)
    this.doneWindow.push(now)
    this.events.push({ type: 'done' })
  }

  result(): ForgeResult {
    const lat = [...this.latencies].sort((a, b) => a - b)
    const pct = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : 0)
    const p50 = Math.round(pct(0.5))
    const p99 = Math.round(this.oom ? Infinity : pct(0.99))
    const rejectPct = this.arrived ? (this.rejected / this.arrived) * 100 : 0
    const g = this.w.goal
    const pass = !this.oom && p99 <= g.p99 && rejectPct <= g.rejectPct
    const ideal = pass && this.w.ideal(this.cfg)
    const stars = !pass ? 0 : ideal ? 3 : 2
    const cpuUtil = this.time ? this.cpuBusy / (this.time * this.w.cores) : 0
    let msg: string
    if (this.oom) msg = `OutOfMemoryError: la cola llegó a ${this.peakQueue} tareas y el heap (${this.w.heapMb} MB) reventó. Una cola sin límite solo esconde el problema hasta que la JVM muere.`
    else if (rejectPct > g.rejectPct) msg = `Rechazaste el ${rejectPct.toFixed(1)}% de las peticiones (máx. ${g.rejectPct}%). Faltan hilos o espacio en la cola para absorber el pico.`
    else if (p99 > g.p99)
      msg =
        this.w.id === 'cpu' && this.peakThreads > this.w.cores * 3
          ? `p99 = ${p99} ms. Con ${this.peakThreads} hilos peleando por ${this.w.cores} núcleos cada tarea tarda más y el cambio de contexto se come la CPU.`
          : `p99 = ${p99} ms (meta ≤ ${g.p99} ms). Las tareas esperan demasiado en la cola: hay pocos hilos para trabajo que pasa casi todo el tiempo esperando.`
    else if (!ideal) msg = `Cumple (p99 ${p99} ms, rechazos ${rejectPct.toFixed(1)}%). ${this.w.idealHint}`
    else msg = `¡Configuración de producción! p99 ${p99} ms, ${rejectPct.toFixed(1)}% rechazos, pico de ${this.peakThreads} hilos y ${Math.round(this.peakMem)} MB.`
    return { completed: this.latencies.length, rejected: this.rejected, rejectPct, p50, p99, peakThreads: this.peakThreads, peakQueue: this.peakQueue, peakMem: Math.round(this.peakMem), oom: this.oom, cpuUtil, pass, stars, msg }
  }
}

export function runForge(cfg: PoolConfig, w: Workload, seed = 7): ForgeResult {
  const s = new ForgeSim(cfg, w, seed)
  while (!s.finished) s.step(0.05)
  return s.result()
}

/** Fórmula de Goetz / Ley de Little: hilos ≈ núcleos × (1 + espera/cálculo) */
export function suggestedThreads(w: Workload) {
  return Math.round(w.cores * (1 + w.waitMs / w.cpuMs))
}
