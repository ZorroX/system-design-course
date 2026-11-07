/**
 * La Posada Saturada — modelo de balanceo de carga.
 * Viajeros (peticiones) llegan al guardia (load balancer) que los envía a una posada (servidor).
 * Cada posada tiene habitaciones (slots de concurrencia) y una cola corta.
 */
import { makeRng } from './rng.ts'

export type InnAlgo = 'manual' | 'rr' | 'lc'
export type TravelerState = 'walking' | 'waiting' | 'toInn' | 'queued' | 'room' | 'done' | 'lost'

export interface Traveler {
  id: number
  long: boolean
  stay: number
  state: TravelerState
  t: number // tiempo en el estado actual
  inn: number
  room: number
  reason?: string
}

export interface Inn {
  rooms: (number | null)[]
  queue: number[]
  fire: boolean
}

export interface InnLevel {
  total: number
  interval: number
  longPct: number
  inns: number
  maxInns: number
  rooms: number
  gold: number
  innCost: number
  watchCost: number
  fire?: { at: number; dur: number; inn: number }
  maxLost: [number, number, number] // umbrales para 3★, 2★, 1★
}

export const INN_LEVELS: InnLevel[] = [
  { total: 20, interval: 1.7, longPct: 0.3, inns: 3, maxInns: 3, rooms: 2, gold: 0, innCost: 3, watchCost: 2, maxLost: [0, 1, 2] },
  { total: 45, interval: 0.9, longPct: 0.3, inns: 3, maxInns: 5, rooms: 2, gold: 8, innCost: 3, watchCost: 2, fire: { at: 12, dur: 15, inn: 1 }, maxLost: [1, 2, 3] },
]

export const SHORT_STAY = 4
export const LONG_STAY = 12
export const WALK = 1.2
export const TO_INN = 0.6
export const GUARD_MAX = 4
export const INN_QUEUE_MAX = 3

export class InnModel {
  level: InnLevel
  time = 0
  travelers: Traveler[] = []
  inns: Inn[] = []
  guardQueue: number[] = []
  algo: InnAlgo
  watch = false
  gold: number
  private rr = 0
  private nextSpawn = 0.5
  private rnd: () => number
  events: { type: 'lost' | 'served' | 'fire' | 'fireOut' | 'enter'; id?: number; inn?: number; reason?: string }[] = []

  constructor(level: InnLevel, algo: InnAlgo, seed = 7) {
    this.level = level
    this.algo = algo
    this.gold = level.gold
    this.rnd = makeRng(seed)
    for (let i = 0; i < level.inns; i++) this.inns.push(this.newInn())
  }

  private newInn(): Inn {
    return { rooms: Array(this.level.rooms).fill(null), queue: [], fire: false }
  }

  get spawned() {
    return this.travelers.length
  }
  get lost() {
    return this.travelers.filter((t) => t.state === 'lost').length
  }
  get served() {
    return this.travelers.filter((t) => t.state === 'done').length
  }
  get finished() {
    return this.spawned >= this.level.total && this.travelers.every((t) => t.state === 'done' || t.state === 'lost')
  }
  stars(): number {
    const [a, b, c] = this.level.maxLost
    const l = this.lost
    return l <= a ? 3 : l <= b ? 2 : l <= c ? 1 : 0
  }

  canBuild() {
    return this.inns.length < this.level.maxInns && this.gold >= this.level.innCost
  }
  build() {
    if (!this.canBuild()) return false
    this.gold -= this.level.innCost
    this.inns.push(this.newInn())
    return true
  }
  canHireWatch() {
    return !this.watch && this.gold >= this.level.watchCost
  }
  hireWatch() {
    if (!this.canHireWatch()) return false
    this.gold -= this.level.watchCost
    this.watch = true
    return true
  }

  private lose(t: Traveler, reason: string) {
    t.state = 'lost'
    t.t = 0
    t.reason = reason
    this.events.push({ type: 'lost', id: t.id, reason })
  }

  /** Enviar al primer viajero de la fila del guardia a la posada i (modo manual o algoritmo). */
  route(i: number) {
    const id = this.guardQueue.shift()
    if (id === undefined) return false
    const t = this.travelers[id]
    t.state = 'toInn'
    t.t = 0
    t.inn = i
    return true
  }

  private load(i: number) {
    const inn = this.inns[i]
    return inn.rooms.filter((r) => r !== null).length + inn.queue.length
  }

  private pick(): number {
    const candidates = this.inns.map((_, i) => i).filter((i) => !(this.watch && this.inns[i].fire))
    if (!candidates.length) return -1
    if (this.algo === 'rr') {
      const i = candidates[this.rr % candidates.length]
      this.rr++
      return i
    }
    // menos ocupada (sin vigía, una posada en llamas parece "vacía"...)
    return candidates.reduce((best, i) => (this.load(i) < this.load(best) ? i : best), candidates[0])
  }

  private arrive(t: Traveler) {
    const inn = this.inns[t.inn]
    if (inn.fire) return this.lose(t, 'La posada está en llamas')
    const free = inn.rooms.indexOf(null)
    if (free >= 0) {
      inn.rooms[free] = t.id
      t.state = 'room'
      t.room = free
      t.t = 0
      this.events.push({ type: 'enter', id: t.id, inn: t.inn })
    } else if (inn.queue.length < INN_QUEUE_MAX) {
      inn.queue.push(t.id)
      t.state = 'queued'
      t.t = 0
    } else this.lose(t, 'Posada llena')
  }

  step(dt: number) {
    this.time += dt
    const L = this.level
    // incendio
    if (L.fire) {
      const inn = this.inns[L.fire.inn]
      if (inn && !inn.fire && this.time >= L.fire.at && this.time < L.fire.at + L.fire.dur) {
        inn.fire = true
        // evacuación: los huéspedes salen (cuentan como atendidos), la cola se pierde
        for (const id of inn.rooms) if (id !== null) this.travelers[id].state = 'done'
        inn.rooms.fill(null)
        for (const id of inn.queue) this.lose(this.travelers[id], 'Evacuado de la cola')
        inn.queue = []
        this.events.push({ type: 'fire', inn: L.fire.inn })
      }
      if (inn && inn.fire && this.time >= L.fire.at + L.fire.dur) {
        inn.fire = false
        this.events.push({ type: 'fireOut', inn: L.fire.inn })
      }
    }
    // llegadas
    if (this.spawned < L.total && this.time >= this.nextSpawn) {
      const long = this.rnd() < L.longPct
      this.travelers.push({ id: this.spawned, long, stay: long ? LONG_STAY : SHORT_STAY, state: 'walking', t: 0, inn: -1, room: -1 })
      this.nextSpawn = this.time + L.interval * (0.7 + this.rnd() * 0.6)
    }
    for (const t of this.travelers) {
      t.t += dt
      if (t.state === 'walking' && t.t >= WALK) {
        if (this.guardQueue.length >= GUARD_MAX) this.lose(t, 'Se cansó de esperar al guardia')
        else {
          t.state = 'waiting'
          t.t = 0
          this.guardQueue.push(t.id)
        }
      } else if (t.state === 'toInn' && t.t >= TO_INN) this.arrive(t)
      else if (t.state === 'room' && t.t >= t.stay) {
        const inn = this.inns[t.inn]
        inn.rooms[t.room] = null
        t.state = 'done'
        t.t = 0
        this.events.push({ type: 'served', id: t.id })
        const next = inn.queue.shift()
        if (next !== undefined) {
          const n = this.travelers[next]
          n.state = 'room'
          n.room = t.room
          n.t = 0
          inn.rooms[t.room] = n.id
        }
      }
    }
    // enrutamiento automático
    if (this.algo !== 'manual') {
      while (this.guardQueue.length) {
        const i = this.pick()
        if (i < 0) break
        this.route(i)
      }
    }
  }
}
