/**
 * La Horda del Viernes Negro — tower defense con patrones de System Design.
 * Coordenadas en un tablero lógico de 800x500.
 */
export type MonsterKind = 'read' | 'static' | 'write' | 'bot'
export type TowerKind = 'cache' | 'cdn' | 'limiter' | 'queue' | 'breaker'

export const PATH: [number, number][] = [
  [6, 110],
  [230, 110],
  [230, 380],
  [520, 380],
  [520, 180],
  [705, 180],
]
export const CORE = { x: 740, y: 180 }

export const SLOTS: [number, number][] = [
  [130, 185],
  [305, 200],
  [150, 305],
  [375, 305],
  [375, 455],
  [600, 300],
  [445, 240],
  [615, 105],
]

export const MONSTERS: Record<MonsterKind, { speed: number; dmg: number; color: number; label: string; reward: number }> = {
  read: { speed: 55, dmg: 1, color: 0x3b82f6, label: 'Lectura', reward: 0.5 },
  static: { speed: 75, dmg: 1, color: 0xeab308, label: 'Estático (imágenes)', reward: 0.5 },
  write: { speed: 42, dmg: 2, color: 0xef4444, label: 'Escritura', reward: 1 },
  bot: { speed: 95, dmg: 1, color: 0xa855f7, label: 'Bot abusivo', reward: 1 },
}

export const UPGRADE_COST = 6
export const OUTAGE_DPS = 2

export const TOWERS: Record<TowerKind, { cost: number; range: number; cooldown: number; targets?: MonsterKind; name: string; icon: string; desc: string }> = {
  cache: { cost: 4, range: 120, cooldown: 0.7, targets: 'read', name: 'Caché', icon: '⚡', desc: 'Responde lecturas desde memoria' },
  cdn: { cost: 5, range: 150, cooldown: 0.45, targets: 'static', name: 'CDN', icon: '🌍', desc: 'Sirve imágenes y archivos desde el borde' },
  limiter: { cost: 4, range: 100, cooldown: 0, targets: 'bot', name: 'Rate limiter', icon: '🚦', desc: 'Deja pasar como mucho 1 bot cada 2 s' },
  queue: { cost: 4, range: 110, cooldown: 0.9, targets: 'write', name: 'Cola', icon: '📨', desc: 'Encola escrituras para procesarlas después' },
  breaker: { cost: 3, range: 0, cooldown: 0, name: 'Circuit breaker', icon: '🛡️', desc: 'Si un servicio cae, falla rápido con fallback' },
}

interface SpawnRule {
  kind: MonsterKind
  count: number
  every: number
  start: number
}
export interface Wave {
  name: string
  intro: string
  rules: SpawnRule[]
  swarms: { at: number; count: number }[]
  outage?: { from: number; to: number }
}

export const WAVES: Wave[] = [
  {
    name: 'Oleada 1 · Curiosos',
    intro: 'Llegan lecturas (azules) e imágenes (amarillas). Una Caché y una CDN cerca del camino las detienen antes del Núcleo.',
    rules: [
      { kind: 'read', count: 14, every: 1.2, start: 0 },
      { kind: 'static', count: 10, every: 1.8, start: 0.6 },
    ],
    swarms: [],
  },
  {
    name: 'Oleada 2 · Ofertas',
    intro: 'Ahora también escrituras (rojas, hacen el doble de daño) y enjambres de bots (violetas, muy rápidos). Colas y rate limiters.',
    rules: [
      { kind: 'read', count: 12, every: 1.1, start: 0 },
      { kind: 'static', count: 8, every: 2, start: 0.5 },
      { kind: 'write', count: 10, every: 1.6, start: 3 },
    ],
    swarms: [
      { at: 6, count: 8 },
      { at: 14, count: 8 },
    ],
  },
  {
    name: 'Oleada 3 · ¡VIERNES NEGRO!',
    intro: 'Todo a la vez, y a mitad de la oleada el servicio de Pagos se caerá durante 9 s. Sin un Circuit breaker, los hilos bloqueados dañarán el Núcleo (2 de vida por segundo).',
    rules: [
      { kind: 'read', count: 20, every: 0.75, start: 0 },
      { kind: 'static', count: 14, every: 1.1, start: 0.4 },
      { kind: 'write', count: 14, every: 1.1, start: 2 },
    ],
    swarms: [
      { at: 5, count: 10 },
      { at: 11, count: 10 },
      { at: 17, count: 10 },
    ],
    outage: { from: 9, to: 18 },
  },
]

export interface Monster {
  id: number
  kind: MonsterKind
  d: number // distancia recorrida en el camino
  alive: boolean
  checked: Set<number> // limiters que ya lo evaluaron
}
export interface Tower {
  kind: TowerKind
  cd: number
  tokens: number
  level: 1 | 2
}
export type BossEvent =
  | { type: 'absorb'; tower: number; monster: number; x: number; y: number }
  | { type: 'block'; tower: number; monster: number }
  | { type: 'hit'; monster: number; dmg: number }
  | { type: 'outage'; on: boolean; protectedBy: boolean }
  | { type: 'waveEnd'; wave: number }
  | { type: 'lost' }
  | { type: 'won' }

const segs = PATH.slice(1).map((p, i) => {
  const a = PATH[i]
  const len = Math.hypot(p[0] - a[0], p[1] - a[1])
  return { a, b: p, len }
})
export const PATH_LEN = segs.reduce((s, x) => s + x.len, 0)

export function pointAt(d: number): [number, number] {
  let rest = d
  for (const s of segs) {
    if (rest <= s.len) {
      const f = rest / s.len
      return [s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f]
    }
    rest -= s.len
  }
  return PATH[PATH.length - 1]
}

export class BossModel {
  hp = 20
  maxHp = 20
  gold = 12
  wave = 0
  phase: 'build' | 'wave' | 'won' | 'lost' = 'build'
  t = 0
  monsters: Monster[] = []
  towers: (Tower | null)[] = SLOTS.map(() => null)
  outage = false
  events: BossEvent[] = []
  private spawnPlan: { at: number; kind: MonsterKind }[] = []
  private nextId = 0
  private outageAcc = 0

  hasBreaker() {
    return this.towers.some((t) => t?.kind === 'breaker')
  }
  canBuild(slot: number, kind: TowerKind) {
    if (this.towers[slot]) return false
    if (kind === 'breaker' && this.hasBreaker()) return false
    return this.gold >= TOWERS[kind].cost
  }
  build(slot: number, kind: TowerKind) {
    if (!this.canBuild(slot, kind)) return false
    this.gold -= TOWERS[kind].cost
    this.towers[slot] = { kind, cd: 0, tokens: 1, level: 1 }
    return true
  }

  canUpgrade(slot: number) {
    const t = this.towers[slot]
    return !!t && t.level === 1 && t.kind !== 'breaker' && this.gold >= UPGRADE_COST
  }
  upgrade(slot: number) {
    if (!this.canUpgrade(slot)) return false
    this.gold -= UPGRADE_COST
    this.towers[slot]!.level = 2
    return true
  }
  /** Rango y cooldown efectivos (nivel 2: +20 de rango y 40% más rápido; limiter más estricto). */
  rangeOf(t: Tower) {
    return TOWERS[t.kind].range + (t.level === 2 ? 20 : 0)
  }
  cooldownOf(t: Tower) {
    return TOWERS[t.kind].cooldown * (t.level === 2 ? 0.6 : 1)
  }

  startWave() {
    if (this.phase !== 'build') return
    const w = WAVES[this.wave]
    this.spawnPlan = []
    for (const r of w.rules) for (let i = 0; i < r.count; i++) this.spawnPlan.push({ at: r.start + i * r.every, kind: r.kind })
    for (const s of w.swarms) for (let i = 0; i < s.count; i++) this.spawnPlan.push({ at: s.at + i * 0.15, kind: 'bot' })
    this.spawnPlan.sort((a, b) => a.at - b.at)
    this.t = 0
    this.phase = 'wave'
  }

  position(m: Monster) {
    return pointAt(m.d)
  }

  step(dt: number) {
    if (this.phase !== 'wave') return
    this.t += dt
    const w = WAVES[this.wave]
    while (this.spawnPlan.length && this.spawnPlan[0].at <= this.t) {
      const s = this.spawnPlan.shift()!
      this.monsters.push({ id: this.nextId++, kind: s.kind, d: 0, alive: true, checked: new Set() })
    }
    // caída de Pagos
    if (w.outage) {
      const on = this.t >= w.outage.from && this.t < w.outage.to
      if (on !== this.outage) {
        this.outage = on
        this.events.push({ type: 'outage', on, protectedBy: this.hasBreaker() })
      }
      if (on && !this.hasBreaker()) {
        this.outageAcc += dt
        while (this.outageAcc >= 1) {
          this.outageAcc -= 1
          this.hp -= OUTAGE_DPS
          this.events.push({ type: 'hit', monster: -1, dmg: OUTAGE_DPS })
        }
      }
    }
    // movimiento
    for (const m of this.monsters) {
      if (!m.alive) continue
      m.d += MONSTERS[m.kind].speed * dt
      if (m.d >= PATH_LEN) {
        m.alive = false
        this.hp -= MONSTERS[m.kind].dmg
        this.events.push({ type: 'hit', monster: m.id, dmg: MONSTERS[m.kind].dmg })
      }
    }
    // torres
    this.towers.forEach((tw, i) => {
      if (!tw) return
      const spec = TOWERS[tw.kind]
      const range = this.rangeOf(tw)
      const [sx, sy] = SLOTS[i]
      if (tw.kind === 'limiter') {
        tw.tokens = Math.min(1, tw.tokens + (tw.level === 2 ? 0.25 : 0.5) * dt)
        for (const m of this.monsters) {
          if (!m.alive || m.kind !== 'bot' || m.checked.has(i)) continue
          const [x, y] = this.position(m)
          if (Math.hypot(x - sx, y - sy) > range) continue
          m.checked.add(i)
          if (tw.tokens >= 1) tw.tokens -= 1
          else {
            m.alive = false
            this.gold += MONSTERS.bot.reward
            this.events.push({ type: 'block', tower: i, monster: m.id })
          }
        }
        return
      }
      if (!spec.targets) return
      tw.cd -= dt
      if (tw.cd > 0) return
      let best: Monster | null = null
      let bestD = Infinity
      for (const m of this.monsters) {
        if (!m.alive || m.kind !== spec.targets) continue
        const [x, y] = this.position(m)
        const dist = Math.hypot(x - sx, y - sy)
        if (dist <= range && m.d > 0 && -m.d < bestD) {
          // prioriza al más avanzado
          bestD = -m.d
          best = m
        }
      }
      if (best) {
        const [x, y] = this.position(best)
        best.alive = false
        this.gold += MONSTERS[best.kind].reward
        tw.cd = this.cooldownOf(tw)
        this.events.push({ type: 'absorb', tower: i, monster: best.id, x, y })
      }
    })
    this.monsters = this.monsters.filter((m) => m.alive)
    if (this.hp <= 0) {
      this.hp = 0
      this.phase = 'lost'
      this.events.push({ type: 'lost' })
      return
    }
    if (!this.spawnPlan.length && !this.monsters.length) {
      this.events.push({ type: 'waveEnd', wave: this.wave })
      this.outage = false
      this.wave++
      if (this.wave >= WAVES.length) {
        this.phase = 'won'
        this.events.push({ type: 'won' })
      } else {
        this.phase = 'build'
        this.gold += 6
      }
    }
  }

  stars() {
    return this.phase !== 'won' ? 0 : this.hp >= 17 ? 3 : this.hp >= 10 ? 2 : 1
  }
}
