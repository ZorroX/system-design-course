/**
 * El Puerto de los Mensajes — particiones, orden por clave y consumer groups.
 */
import { makeRng } from './rng.ts'

export interface Crate {
  id: number
  merchant: number
  seq: number
  lane: number // -1 en el muelle de entrada
  heavy: boolean
  state: 'intake' | 'lane' | 'done' | 'lost'
}

export const MERCHANT_COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308, 0xa855f7, 0xf97316, 0x14b8a6, 0xec4899]
export const MERCHANT_NAMES = ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Violeta', 'Naranja', 'Turquesa', 'Rosa']

/* ---------------- Nivel 1: enrutamiento manual ---------------- */
export const HARBOR_L1 = { crates: 24, merchants: 6, lanes: 3, interval: 1.0, light: 1.0, heavy: 4.2, heavyPct: 0.3, laneCap: 6, intakeMax: 3 }

export class HarborManual {
  time = 0
  crates: Crate[] = []
  disorder = 0
  lost = 0
  intake: number[] = []
  workerT: number[] // progreso del trabajador de cada carril
  private nextSpawn = 0.8
  private seqs: number[]
  private order: number[]
  private heavyOf: boolean[]
  events: { type: 'disorder' | 'lost' | 'done'; id: number }[] = []

  constructor(seed = 11) {
    const c = HARBOR_L1
    this.workerT = Array(c.lanes).fill(0)
    this.seqs = Array(c.merchants).fill(0)
    const rnd = makeRng(seed)
    // orden de llegada: mezcla de comerciantes con 4 cajas cada uno
    const pool = Array.from({ length: c.crates }, (_, i) => i % c.merchants)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    this.order = pool
    this.heavyOf = pool.map(() => rnd() < c.heavyPct)
  }

  get finished() {
    return this.crates.length >= HARBOR_L1.crates && this.crates.every((c) => c.state === 'done' || c.state === 'lost')
  }
  errors() {
    return this.disorder + this.lost
  }
  stars() {
    const e = this.errors()
    return e === 0 ? 3 : e === 1 ? 2 : 0
  }
  laneCrates(l: number) {
    return this.crates.filter((c) => c.state === 'lane' && c.lane === l)
  }

  send(lane: number) {
    const id = this.intake.shift()
    if (id === undefined) return false
    const crate = this.crates[id]
    if (this.laneCrates(lane).length >= HARBOR_L1.laneCap) {
      crate.state = 'lost'
      this.lost++
      this.events.push({ type: 'lost', id })
      return true
    }
    crate.state = 'lane'
    crate.lane = lane
    return true
  }

  step(dt: number) {
    const c = HARBOR_L1
    this.time += dt
    if (this.crates.length < c.crates && this.time >= this.nextSpawn) {
      const m = this.order[this.crates.length]
      const crate: Crate = { id: this.crates.length, merchant: m, seq: ++this.seqs[m], lane: -1, state: 'intake', heavy: this.heavyOf[this.crates.length] }
      this.crates.push(crate)
      if (this.intake.length >= c.intakeMax) {
        crate.state = 'lost'
        this.lost++
        this.events.push({ type: 'lost', id: crate.id })
      } else this.intake.push(crate.id)
      this.nextSpawn = this.time + c.interval
    }
    for (let l = 0; l < c.lanes; l++) {
      const q = this.laneCrates(l)
      if (!q.length) {
        this.workerT[l] = 0
        continue
      }
      this.workerT[l] += dt
      const head = q[0]
      if (this.workerT[l] >= (head.heavy ? c.heavy : c.light)) {
        this.workerT[l] = 0
        // desorden: ¿queda sin procesar una caja anterior del mismo comerciante?
        const earlier = this.crates.some((x) => x.merchant === head.merchant && x.seq < head.seq && (x.state === 'lane' || x.state === 'intake'))
        if (earlier) {
          this.disorder++
          this.events.push({ type: 'disorder', id: head.id })
        }
        head.state = 'done'
        this.events.push({ type: 'done', id: head.id })
      }
    }
  }
}

/* ---------------- Nivel 2: la marea (enrutamiento por hash de clave) ---------------- */
export const HARBOR_L2 = { budget: 12, laneCost: 1, workerCost: 2, merchants: 8, spikeAt: 2, spike: 60, steady: 1, bell: 20, work: 1.0, maxLag: 12, maxLanes: 6, maxWorkers: 6 }

export class HarborStorm {
  time = 0
  queues: number[] // cajas pendientes por carril
  workerT: number[]
  processed = 0
  arrived = 0
  lanes: number
  workers: number
  private steadyAcc = 0
  private rr = 0
  private spikeDone = false
  history: number[] = []

  constructor(lanes: number, workers: number) {
    this.lanes = lanes
    this.workers = workers
    this.queues = Array(lanes).fill(0)
    this.workerT = Array(workers).fill(0)
  }

  static cost(lanes: number, workers: number) {
    return lanes * HARBOR_L2.laneCost + workers * HARBOR_L2.workerCost
  }

  /** Clave del comerciante -> carril (partición). */
  laneOf(merchant: number) {
    return merchant % this.lanes
  }

  /** Carriles asignados a cada trabajador (como un consumer group): p % workers. */
  lanesOfWorker(w: number): number[] {
    if (w >= this.lanes) return [] // ocioso: más consumidores que particiones
    return Array.from({ length: this.lanes }, (_, p) => p).filter((p) => p % Math.min(this.workers, this.lanes) === w)
  }

  private add() {
    const m = this.rr++ % HARBOR_L2.merchants
    this.queues[this.laneOf(m)]++
    this.arrived++
  }

  get lag() {
    return this.queues.reduce((a, b) => a + b, 0)
  }
  get done() {
    return this.time >= HARBOR_L2.bell
  }
  passed() {
    return this.lag <= HARBOR_L2.maxLag
  }

  step(dt: number) {
    const c = HARBOR_L2
    if (this.done) return
    this.time += dt
    if (!this.spikeDone && this.time >= c.spikeAt) {
      for (let i = 0; i < c.spike; i++) this.add()
      this.spikeDone = true
    }
    this.steadyAcc += c.steady * dt
    while (this.steadyAcc >= 1) {
      this.add()
      this.steadyAcc -= 1
    }
    for (let w = 0; w < this.workers; w++) {
      const mine = this.lanesOfWorker(w)
      const busy = mine.filter((p) => this.queues[p] > 0)
      if (!busy.length) {
        this.workerT[w] = 0
        continue
      }
      this.workerT[w] += dt
      if (this.workerT[w] >= c.work) {
        this.workerT[w] -= c.work
        const p = busy.reduce((a, b) => (this.queues[b] > this.queues[a] ? b : a), busy[0])
        this.queues[p]--
        this.processed++
      }
    }
  }
}
