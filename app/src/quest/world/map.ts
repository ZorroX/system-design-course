/**
 * Mapa del Reino de Nimbus. Se parte de un bosque cerrado y se "tallan" regiones y pasillos:
 * así las nieblas de los pasillos no se pueden rodear.
 */
import { T } from '../art'
import { makeRng } from '../models/rng'
import type { PuzzleId } from '@/store/game'

export const MAP_W = 56
export const MAP_H = 44

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}
export interface RegionDef extends Rect {
  id: string
  name: string
}
export interface NpcDef {
  id: string
  look: string
  x: number
  y: number
  face: 'down' | 'up' | 'left' | 'right'
}
export interface ShrineDef {
  puzzle: PuzzleId | 'boss'
  x: number
  y: number
  guardian: string // id del NPC que presenta la prueba
}
export interface GateDef {
  id: string
  cells: [number, number][]
  req: number // pilares necesarios
}
export interface ScrollDef {
  id: string
  x: number
  y: number
  codex: string
}
export interface SignDef {
  x: number
  y: number
  text: string
}

export const REGIONS: RegionDef[] = [
  { id: 'capital', name: 'Ciudad Monolito', x0: 19, y0: 18, x1: 37, y1: 30 },
  { id: 'library', name: 'Biblioteca de la Memoria', x0: 20, y0: 2, x1: 38, y1: 9 },
  { id: 'citadel', name: 'Ciudadela del Pico', x0: 44, y0: 1, x1: 54, y1: 12 },
  { id: 'harbor', name: 'Puerto de los Mensajes', x0: 1, y0: 14, x1: 11, y1: 34 },
  { id: 'ring', name: 'Bosque del Anillo', x0: 42, y0: 16, x1: 54, y1: 32 },
  { id: 'valley', name: 'Valle Partido', x0: 14, y0: 34, x1: 42, y1: 42 },
  { id: 'treasury', name: 'Distrito del Tesoro', x0: 1, y0: 1, x1: 17, y1: 12 },
]

export const NPCS: NpcDef[] = [
  { id: 'ada', look: 'ada', x: 30, y: 25, face: 'left' },
  { id: 'tomas', look: 'tomas', x: 33, y: 21, face: 'down' },
  { id: 'vil-latency', look: 'vil1', x: 22, y: 23, face: 'right' },
  { id: 'vil-scale', look: 'vil3', x: 35, y: 25, face: 'left' },
  { id: 'guard-south', look: 'guard', x: 30, y: 29, face: 'left' },
  { id: 'lia', look: 'lia', x: 26, y: 8, face: 'down' },
  { id: 'vil-library', look: 'vil4', x: 34, y: 6, face: 'left' },
  { id: 'offset', look: 'offset', x: 8, y: 23, face: 'right' },
  { id: 'vil-harbor', look: 'vil2', x: 6, y: 28, face: 'up' },
  { id: 'rin', look: 'rin', x: 46, y: 22, face: 'down' },
  { id: 'paxi', look: 'paxi', x: 24, y: 36, face: 'left' },
  { id: 'vil-valley', look: 'vil1', x: 33, y: 36, face: 'down' },
  { id: 'guard-citadel', look: 'guard', x: 51, y: 9, face: 'left' },
  { id: 'sage', look: 'sage', x: 45, y: 11, face: 'right' },
  // Distrito del Tesoro
  { id: 'hilda', look: 'hilda', x: 4, y: 4, face: 'down' },
  { id: 'idem', look: 'idem', x: 10, y: 4, face: 'down' },
  { id: 'jota', look: 'jota', x: 15, y: 4, face: 'down' },
  { id: 'tece', look: 'tece', x: 4, y: 10, face: 'down' },
  { id: 'estrella', look: 'estrella', x: 10, y: 11, face: 'left' },
  { id: 'canaria', look: 'canaria', x: 15, y: 10, face: 'down' },
  { id: 'herald', look: 'vil2', x: 20, y: 18, face: 'left' },
  { id: 'vil-treasury', look: 'vil4', x: 2, y: 7, face: 'right' },
]

export const SHRINES: ShrineDef[] = [
  { puzzle: 'inn', x: 35, y: 20, guardian: 'tomas' },
  { puzzle: 'library', x: 28, y: 6, guardian: 'lia' },
  { puzzle: 'harbor', x: 9, y: 21, guardian: 'offset' },
  { puzzle: 'ring', x: 48, y: 24, guardian: 'rin' },
  { puzzle: 'bridge', x: 20, y: 36, guardian: 'paxi' },
  { puzzle: 'boss', x: 49, y: 7, guardian: 'guard-citadel' },
  { puzzle: 'forge', x: 3, y: 3, guardian: 'hilda' },
  { puzzle: 'vault', x: 9, y: 3, guardian: 'idem' },
  { puzzle: 'tower', x: 14, y: 3, guardian: 'jota' },
  { puzzle: 'caravan', x: 3, y: 9, guardian: 'tece' },
  { puzzle: 'council', x: 9, y: 10, guardian: 'estrella' },
  { puzzle: 'aviary', x: 14, y: 9, guardian: 'canaria' },
]

/** Sellos de la bóveda del Distrito del Tesoro (se encienden como los pilares). */
export const SEALS: Partial<Record<PuzzleId, [number, number]>> = {
  forge: [5, 5],
  vault: [6, 5],
  tower: [7, 5],
  caravan: [11, 5],
  aviary: [12, 5],
  council: [13, 5],
}

export const PILLARS: Partial<Record<PuzzleId, [number, number]>> = {
  inn: [26, 21],
  library: [30, 21],
  ring: [32, 24],
  harbor: [24, 24],
  bridge: [28, 27],
}
export const CRYSTAL: [number, number] = [28, 23]

export const GATES: GateDef[] = [
  { id: 'north', cells: [[27, 15], [28, 15], [29, 15]], req: 1 },
  { id: 'west', cells: [[16, 23], [16, 24], [16, 25]], req: 1 },
  { id: 'east', cells: [[39, 23], [39, 24], [39, 25]], req: 2 },
  { id: 'south', cells: [[27, 32], [28, 32], [29, 32]], req: 3 },
  { id: 'citadel', cells: [[41, 8], [41, 9], [41, 10]], req: 5 },
]

export const SCROLLS: ScrollDef[] = [
  { id: 's-latency', x: 36, y: 29, codex: 'latency' },
  { id: 's-estimation', x: 20, y: 22, codex: 'estimation' },
  { id: 's-stateless', x: 13, y: 25, codex: 'stateless' },
  { id: 's-idempotency', x: 37, y: 3, codex: 'idempotency' },
  { id: 's-sharding', x: 2, y: 30, codex: 'sharding' },
  { id: 's-observability', x: 53, y: 31, codex: 'observability' },
  { id: 's-search', x: 41, y: 35, codex: 'search' },
  { id: 's-saga', x: 45, y: 2, codex: 'saga' },
  { id: 's-kiss', x: 16, y: 12, codex: 'kiss' },
  { id: 's-english', x: 1, y: 1, codex: 'english' },
]

export const SIGNS: SignDef[] = [
  { x: 23, y: 28, text: 'Ciudad Monolito. Norte: Biblioteca · Oeste: Puerto · Este: Bosque del Anillo · Sur: Valle Partido.' },
  { x: 30, y: 13, text: 'Biblioteca de la Memoria. "Lo que se usa a menudo, se guarda cerca."' },
  { x: 14, y: 23, text: 'Puerto de los Mensajes. Cuidado: las cajas de un mismo mercader deben llegar en orden.' },
  { x: 40, y: 22, text: 'Bosque del Anillo. Los custodios guardan los orbes del reino en círculo.' },
  { x: 30, y: 33, text: 'Valle Partido. El puente cayó hace una semana… y el pueblo sigue discutiendo.' },
  { x: 18, y: 15, text: 'Distrito del Tesoro (noroeste). Seis sellos guardan la bóveda de Nimbus: idempotencia, hilos, diagnóstico, transacciones, despliegues y liderazgo. Entrenamiento para tu entrevista.' },
]

export const START: [number, number] = [28, 25]

export function regionAt(x: number, y: number): RegionDef | undefined {
  return REGIONS.find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)
}

/* ------------------------------ Construcción ------------------------------ */
export function buildMap(): number[][] {
  const g: number[][] = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(T.TREE))
  const protect = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y][x] = t
  }
  const fill = (r: Rect, t: number) => {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) set(x, y, t)
  }
  const path = (pts: [number, number][]) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]
      const [bx, by] = pts[i]
      const dx = Math.sign(bx - ax)
      const dy = Math.sign(by - ay)
      let x = ax
      let y = ay
      for (;;) {
        set(x, y, T.PATH)
        protect.add(key(x, y))
        if (x === bx && y === by) break
        x += dx
        y += dy
      }
    }
  }
  const building = (x: number, y: number, w: number, roofRows: number, wallRows: number, doorX?: number, doorTile: number = T.DOOR) => {
    for (let yy = y; yy < y + roofRows; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, T.ROOF)
    for (let yy = y + roofRows; yy < y + roofRows + wallRows; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, T.HOUSE)
    if (doorX !== undefined) set(doorX, y + roofRows + wallRows - 1, doorTile)
    for (let yy = y - 1; yy <= y + roofRows + wallRows; yy++) for (let xx = x - 1; xx <= x + w; xx++) protect.add(key(xx, yy))
  }

  // Regiones abiertas
  for (const r of REGIONS) fill(r, T.GRASS)
  // Pasillos
  fill({ x0: 27, y0: 10, x1: 29, y1: 17 }, T.GRASS)
  fill({ x0: 39, y0: 8, x1: 43, y1: 10 }, T.GRASS)
  fill({ x0: 12, y0: 23, x1: 18, y1: 25 }, T.GRASS)
  fill({ x0: 38, y0: 23, x1: 41, y1: 25 }, T.GRASS)
  fill({ x0: 27, y0: 31, x1: 29, y1: 33 }, T.GRASS)
  fill({ x0: 18, y0: 11, x1: 19, y1: 18 }, T.GRASS) // sendero al Distrito del Tesoro

  // Capital
  fill({ x0: 24, y0: 21, x1: 32, y1: 27 }, T.PLAZA)
  for (let y = 21; y <= 27; y++) for (let x = 24; x <= 32; x++) protect.add(key(x, y))
  set(CRYSTAL[0], CRYSTAL[1], T.PEDESTAL)
  for (const v of Object.values(PILLARS)) if (v) set(v[0], v[1], T.PILLAR_OFF)
  building(20, 19, 3, 1, 1, 21)
  building(20, 28, 3, 1, 1, 21)
  building(34, 27, 3, 1, 1, 35)
  building(33, 18, 4, 2, 1, 35, T.SHRINE) // La Posada
  path([[28, 28], [28, 30]])
  path([[28, 20], [28, 17]])
  path([[23, 24], [19, 24]])
  path([[33, 24], [37, 24]])
  path([[35, 21], [35, 23], [33, 23]])

  // Norte: Biblioteca
  path([[28, 17], [28, 7]])
  building(24, 2, 9, 2, 3, 28, T.SHRINE)
  set(21, 4, T.SHELF)
  set(22, 4, T.SHELF)
  set(35, 3, T.SHELF)
  path([[28, 9], [38, 9]])
  path([[38, 9], [44, 9], [49, 9], [49, 8]])
  // Ciudadela
  fill({ x0: 46, y0: 2, x1: 52, y1: 7 }, T.WALL)
  set(49, 7, T.SHRINE)
  for (let y = 1; y <= 8; y++) for (let x = 45; x <= 53; x++) protect.add(key(x, y))

  // Oeste: Puerto
  fill({ x0: 1, y0: 14, x1: 4, y1: 34 }, T.WATER)
  fill({ x0: 5, y0: 14, x1: 6, y1: 34 }, T.SAND)
  for (const y of [18, 24, 30]) for (let x = 2; x <= 4; x++) set(x, y, T.DOCK)
  building(7, 19, 4, 2, 1, 9, T.SHRINE)
  path([[19, 24], [9, 24], [9, 22]])
  for (let y = 14; y <= 34; y++) for (let x = 1; x <= 6; x++) protect.add(key(x, y))

  // Este: Bosque del Anillo
  path([[37, 24], [47, 24]])
  const cx = 48
  const cy = 24
  for (let y = cy - 6; y <= cy + 6; y++)
    for (let x = cx - 6; x <= cx + 6; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d >= 4.5 && d < 5.5 && !(x < cx && Math.abs(y - cy) <= 1)) set(x, y, T.ROCK)
      if (d < 5.5) protect.add(key(x, y))
    }
  set(cx, cy, T.ALTAR)

  // Sur: Valle Partido
  path([[28, 30], [28, 37]])
  fill({ x0: 14, y0: 38, x1: 42, y1: 39 }, T.WATER)
  set(28, 38, T.BRIDGE)
  set(28, 39, T.BROKEN)
  building(18, 34, 5, 2, 1, 20, T.SHRINE) // Concejo del Puente
  path([[28, 37], [20, 37]])
  building(30, 40, 3, 1, 1, 31)
  building(36, 40, 3, 1, 1, 37)
  building(17, 40, 3, 1, 1, 18)
  for (let y = 38; y <= 42; y++) for (let x = 14; x <= 42; x++) protect.add(key(x, y))

  // Noroeste: Distrito del Tesoro
  building(2, 2, 4, 1, 1, 3, T.SHRINE) // Forja de Hilos
  building(7, 1, 5, 2, 1, 9, T.SHRINE) // Bóveda
  building(13, 1, 3, 2, 1, 14, T.SHRINE) // Torre del Vigía
  building(2, 8, 4, 1, 1, 3, T.SHRINE) // Ruta de las Caravanas
  building(7, 8, 5, 1, 2, 9, T.SHRINE) // Consejo
  building(13, 8, 3, 1, 1, 14, T.SHRINE) // Pajarera
  for (const v of Object.values(SEALS)) if (v) set(v[0], v[1], T.PILLAR_OFF)
  path([[19, 18], [19, 11], [17, 11], [17, 6], [1, 6]])
  for (let y = 4; y <= 7; y++) for (let x = 1; x <= 17; x++) protect.add(key(x, y))
  for (let x = 1; x <= 17; x++) protect.add(key(x, 11))

  // Señales y objetos (no se tapan con decoración)
  for (const s of SIGNS) {
    set(s.x, s.y, T.SIGN)
    protect.add(key(s.x, s.y))
  }
  for (const o of [...NPCS, ...SCROLLS]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) protect.add(key(o.x + dx, o.y + dy))
  for (const gt of GATES) for (const [x, y] of gt.cells) protect.add(key(x, y))

  // Decoración con semilla (nunca junto a caminos)
  const r = makeRng(1234)
  const nearPath = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy]?.[x + dx] === T.PATH) return true
    return false
  }
  for (const reg of REGIONS) {
    for (let y = reg.y0 + 1; y < reg.y1; y++)
      for (let x = reg.x0 + 1; x < reg.x1; x++) {
        if (g[y][x] !== T.GRASS || protect.has(key(x, y))) continue
        const u = r()
        if (u < 0.07) g[y][x] = T.FLOWERS
        else if (u < 0.11) g[y][x] = T.TALLGRASS
        else if (!nearPath(x, y) && reg.id !== 'citadel') {
          if (u < 0.135) g[y][x] = T.TREE
          else if (u < 0.15) g[y][x] = T.BUSH
          else if (u < 0.155) g[y][x] = T.ROCK
        }
      }
  }
  // borde de agua en la costa sur del valle
  for (let x = 14; x <= 42; x++) if (g[40]?.[x] === T.GRASS && r() < 0.15) g[40][x] = T.FLOWERS
  return g
}
