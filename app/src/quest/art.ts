/**
 * Pixel art procedural: todo el arte de NIMBUS se dibuja con código en canvas.
 * No depende de Phaser (también se usa para los retratos de los diálogos en React).
 */
import { makeRng } from './models/rng'

export const TILE = 16
type Ctx = CanvasRenderingContext2D

export const T = {
  GRASS: 0,
  FLOWERS: 1,
  PATH: 2,
  PLAZA: 3,
  WATER: 4,
  WATER2: 5,
  SAND: 6,
  TREE: 7,
  ROCK: 8,
  WALL: 9,
  ROOF: 10,
  HOUSE: 11,
  DOOR: 12,
  BRIDGE: 13,
  DOCK: 14,
  SHRINE: 15,
  PILLAR_OFF: 16,
  PILLAR_ON: 17,
  PEDESTAL: 18,
  FENCE: 19,
  TALLGRASS: 20,
  BUSH: 21,
  SIGN: 22,
  ALTAR: 23,
  BROKEN: 24,
  SHELF: 25,
} as const
export const TILE_COUNT = 26
export const SOLID: number[] = [T.WATER, T.WATER2, T.TREE, T.ROCK, T.WALL, T.ROOF, T.HOUSE, T.DOOR, T.SHRINE, T.PILLAR_OFF, T.PILLAR_ON, T.PEDESTAL, T.FENCE, T.BUSH, T.SIGN, T.ALTAR, T.BROKEN, T.SHELF]

const OUT = '#1d1a2b'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return { c, ctx }
}
const px = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/* =========================== TILES =========================== */
function speckle(ctx: Ctx, ox: number, seed: number, base: string, colors: string[], n: number) {
  px(ctx, ox, 0, TILE, TILE, base)
  const r = makeRng(seed)
  for (let i = 0; i < n; i++) px(ctx, ox + Math.floor(r() * TILE), Math.floor(r() * TILE), 1, 1, colors[Math.floor(r() * colors.length)])
}
function grass(ctx: Ctx, ox: number, seed = 1) {
  speckle(ctx, ox, seed, '#5b9e4b', ['#4a8740', '#72b85c', '#4f9144'], 34)
  const r = makeRng(seed + 99)
  for (let i = 0; i < 3; i++) {
    const x = ox + 2 + Math.floor(r() * 12)
    const y = 3 + Math.floor(r() * 11)
    px(ctx, x, y, 1, 2, '#3f7a37')
    px(ctx, x + 1, y + 1, 1, 1, '#3f7a37')
  }
}
function drawTiles(): HTMLCanvasElement {
  const { c, ctx } = canvas(TILE * TILE_COUNT, TILE)
  const at = (i: number) => i * TILE

  grass(ctx, at(T.GRASS), 3)

  grass(ctx, at(T.FLOWERS), 8)
  for (const [x, y, col] of [[3, 4, '#fff7d6'], [10, 3, '#f9a8d4'], [6, 10, '#fde047'], [12, 11, '#fff7d6'], [2, 13, '#f9a8d4']] as [number, number, string][]) {
    px(ctx, at(T.FLOWERS) + x, y, 2, 2, col)
    px(ctx, at(T.FLOWERS) + x, y + 2, 1, 1, '#3f7a37')
  }

  speckle(ctx, at(T.PATH), 5, '#c9a46a', ['#a98552', '#dcbb84', '#b8955e'], 40)

  {
    const o = at(T.PLAZA)
    speckle(ctx, o, 6, '#9aa4b1', ['#b3bcc8', '#8d97a4'], 18)
    px(ctx, o, 7, 16, 1, '#7b8593')
    px(ctx, o, 15, 16, 1, '#7b8593')
    px(ctx, o + 7, 0, 1, 7, '#7b8593')
    px(ctx, o + 15, 8, 1, 7, '#7b8593')
  }

  for (const [idx, shift] of [[T.WATER, 0], [T.WATER2, 4]] as const) {
    const o = at(idx)
    px(ctx, o, 0, 16, 16, '#3a7bd5')
    for (const [x, y] of [[1, 3], [9, 6], [4, 11], [12, 13]]) {
      const xx = (x + shift) % 14
      px(ctx, o + xx, y, 3, 1, '#62a0ee')
      px(ctx, o + xx + 1, y - 1, 2, 1, '#8cc0f5')
    }
    px(ctx, o + ((7 + shift) % 14), 15, 2, 1, '#2e64b3')
  }

  speckle(ctx, at(T.SAND), 7, '#e2cf8e', ['#c9b574', '#efe0a8'], 30)

  {
    const o = at(T.TREE)
    grass(ctx, o, 11)
    px(ctx, o + 6, 11, 4, 4, '#6b4a2b')
    px(ctx, o + 7, 11, 1, 4, '#80592f')
    ctx.fillStyle = '#215e33'
    ctx.beginPath()
    ctx.arc(o + 8, 7, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2e7d43'
    ctx.beginPath()
    ctx.arc(o + 7.5, 6.5, 6, 0, Math.PI * 2)
    ctx.fill()
    for (const [x, y] of [[5, 3], [9, 4], [4, 7], [10, 8], [7, 6]]) px(ctx, o + x, y, 2, 2, '#43a05a')
    px(ctx, o + 2, 9, 1, 1, '#215e33')
  }

  {
    const o = at(T.ROCK)
    grass(ctx, o, 13)
    px(ctx, o + 2, 6, 12, 8, '#8d929a')
    px(ctx, o + 3, 4, 10, 2, '#8d929a')
    px(ctx, o + 4, 4, 5, 3, '#b0b5bc')
    px(ctx, o + 2, 12, 12, 2, '#6a6f77')
    px(ctx, o + 11, 6, 2, 6, '#7a7f87')
  }

  {
    const o = at(T.WALL)
    px(ctx, o, 0, 16, 16, '#8a8f9c')
    for (let y = 0; y < 16; y += 4) {
      px(ctx, o, y + 3, 16, 1, '#6d7280')
      const off = (y / 4) % 2 ? 4 : 0
      for (let x = off; x < 16; x += 8) px(ctx, o + x, y, 1, 3, '#6d7280')
    }
    px(ctx, o, 0, 16, 1, '#a3a8b4')
  }

  {
    const o = at(T.ROOF)
    px(ctx, o, 0, 16, 16, '#b4513b')
    for (let y = 2; y < 16; y += 4) px(ctx, o, y, 16, 1, '#8e3c2b')
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) px(ctx, o + x, y, 1, 2, '#8e3c2b')
    px(ctx, o, 0, 16, 1, '#d0684f')
  }

  {
    const o = at(T.HOUSE)
    px(ctx, o, 0, 16, 16, '#e7d6ae')
    px(ctx, o, 0, 16, 2, '#7a5a3a')
    px(ctx, o + 4, 5, 8, 6, '#7a5a3a')
    px(ctx, o + 5, 6, 6, 4, '#5aa5e6')
    px(ctx, o + 5, 6, 2, 2, '#bfe0fb')
    px(ctx, o + 7, 6, 1, 4, '#7a5a3a')
    px(ctx, o, 14, 16, 2, '#cdb98c')
  }

  {
    const o = at(T.DOOR)
    px(ctx, o, 0, 16, 16, '#e7d6ae')
    px(ctx, o, 0, 16, 2, '#7a5a3a')
    px(ctx, o + 4, 4, 8, 12, '#5a3a20')
    px(ctx, o + 5, 5, 6, 11, '#7a4e2c')
    px(ctx, o + 9, 10, 1, 1, '#fde047')
  }

  {
    const o = at(T.BRIDGE)
    px(ctx, o, 0, 16, 16, '#3a7bd5')
    for (let x = 0; x < 16; x += 4) {
      px(ctx, o + x, 1, 3, 14, '#a4733f')
      px(ctx, o + x, 1, 3, 1, '#c18d55')
      px(ctx, o + x + 3, 1, 1, 14, '#7d5530')
    }
    px(ctx, o, 0, 16, 1, '#7d5530')
    px(ctx, o, 15, 16, 1, '#7d5530')
  }

  {
    const o = at(T.DOCK)
    px(ctx, o, 0, 16, 16, '#9a6b3f')
    for (let y = 0; y < 16; y += 4) px(ctx, o, y + 3, 16, 1, '#7a522d')
    px(ctx, o + 2, 1, 1, 1, '#5a3a20')
    px(ctx, o + 13, 9, 1, 1, '#5a3a20')
  }

  {
    const o = at(T.SHRINE)
    px(ctx, o, 0, 16, 16, '#6d6a8a')
    px(ctx, o, 0, 16, 1, '#8f8cab')
    px(ctx, o + 3, 3, 10, 13, '#2b2846')
    px(ctx, o + 4, 4, 8, 12, '#3a2f6b')
    px(ctx, o + 5, 6, 6, 10, '#7c4dcc')
    px(ctx, o + 6, 8, 4, 8, '#b78cff')
    px(ctx, o + 7, 10, 2, 6, '#7ef0ff')
    px(ctx, o + 7, 1, 2, 1, '#7ef0ff')
  }

  for (const [idx, on] of [[T.PILLAR_OFF, false], [T.PILLAR_ON, true]] as const) {
    const o = at(idx)
    speckle(ctx, o, 6, '#9aa4b1', ['#b3bcc8', '#8d97a4'], 18)
    px(ctx, o + 4, 13, 8, 3, '#7b8593')
    px(ctx, o + 5, 4, 6, 9, '#c9ccd6')
    px(ctx, o + 5, 4, 1, 9, '#e6e8ee')
    px(ctx, o + 10, 4, 1, 9, '#9da1ad')
    px(ctx, o + 4, 3, 8, 2, '#d8dbe3')
    px(ctx, o + 6, 0, 4, 4, on ? '#7ef0ff' : '#555a66')
    px(ctx, o + 7, 0, 2, 2, on ? '#e0fdff' : '#6b7080')
  }

  {
    const o = at(T.PEDESTAL)
    speckle(ctx, o, 6, '#9aa4b1', ['#b3bcc8', '#8d97a4'], 18)
    px(ctx, o + 1, 8, 14, 8, '#6d6a8a')
    px(ctx, o + 2, 9, 12, 2, '#8f8cab')
    px(ctx, o + 1, 15, 14, 1, '#4b4866')
  }

  {
    const o = at(T.FENCE)
    grass(ctx, o, 17)
    px(ctx, o, 6, 16, 2, '#a47a4a')
    px(ctx, o, 10, 16, 2, '#a47a4a')
    for (const x of [1, 8]) px(ctx, o + x, 4, 3, 11, '#8a6239')
  }

  {
    const o = at(T.TALLGRASS)
    grass(ctx, o, 19)
    for (let i = 0; i < 6; i++) {
      const x = 1 + i * 2.6
      px(ctx, o + Math.floor(x), 6, 1, 8, '#3f7a37')
      px(ctx, o + Math.floor(x) + 1, 8, 1, 6, '#6fae58')
    }
  }

  {
    const o = at(T.BUSH)
    grass(ctx, o, 21)
    ctx.fillStyle = '#2b7040'
    ctx.beginPath()
    ctx.arc(o + 8, 10, 6, 0, Math.PI * 2)
    ctx.fill()
    px(ctx, o + 5, 7, 2, 2, '#43a05a')
    px(ctx, o + 9, 9, 2, 2, '#43a05a')
    px(ctx, o + 7, 12, 1, 1, '#e11d48')
    px(ctx, o + 10, 6, 1, 1, '#e11d48')
  }

  {
    const o = at(T.SIGN)
    grass(ctx, o, 23)
    px(ctx, o + 7, 8, 2, 7, '#6b4a2b')
    px(ctx, o + 2, 2, 12, 7, '#a47a4a')
    px(ctx, o + 2, 2, 12, 1, '#c49a64')
    px(ctx, o + 4, 4, 8, 1, '#5a3a20')
    px(ctx, o + 4, 6, 6, 1, '#5a3a20')
  }

  {
    const o = at(T.ALTAR)
    grass(ctx, o, 25)
    px(ctx, o + 2, 8, 12, 7, '#6a6f77')
    px(ctx, o + 3, 7, 10, 2, '#8d929a')
    px(ctx, o + 6, 2, 4, 5, '#7ef0ff')
    px(ctx, o + 7, 3, 2, 2, '#e0fdff')
    px(ctx, o + 5, 10, 6, 2, '#b78cff')
  }

  {
    const o = at(T.BROKEN)
    px(ctx, o, 0, 16, 16, '#3a7bd5')
    px(ctx, o + 1, 0, 3, 6, '#a4733f')
    px(ctx, o + 9, 0, 3, 4, '#a4733f')
    px(ctx, o + 5, 9, 3, 3, '#7d5530')
    px(ctx, o + 3, 13, 6, 1, '#62a0ee')
  }

  {
    const o = at(T.SHELF)
    px(ctx, o, 0, 16, 16, '#5a3a20')
    for (let y = 1; y < 16; y += 5) {
      px(ctx, o + 1, y, 14, 4, '#3d2614')
      const r = makeRng(y + 3)
      for (let x = 1; x < 15; x += 2) px(ctx, o + x, y + 1, 2, 3, ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'][Math.floor(r() * 5)])
    }
  }
  return c
}

/* =========================== PERSONAJES =========================== */
export type Acc = 'scarf' | 'wizard' | 'apron' | 'glasses' | 'hood' | 'captain' | 'crown' | 'helmet' | 'none'
export interface Look {
  skin: string
  hair: string
  shirt: string
  pants: string
  acc: Acc
  accColor?: string
  beard?: boolean
}

export const LOOKS: Record<string, Look> = {
  hero: { skin: '#f1c27d', hair: '#5b3a29', shirt: '#2f6fd6', pants: '#33334d', acc: 'scarf', accColor: '#22d3ee' },
  ada: { skin: '#f3d1b0', hair: '#e5e7eb', shirt: '#6d3fb0', pants: '#4c2a80', acc: 'wizard', accColor: '#7c4dcc' },
  tomas: { skin: '#d9a066', hair: '#2b2b2b', shirt: '#c0392b', pants: '#3d2b1f', acc: 'apron', accColor: '#f5f5f5', beard: true },
  lia: { skin: '#f6d5b8', hair: '#b5542b', shirt: '#2e7d6b', pants: '#264a43', acc: 'glasses' },
  rin: { skin: '#e0b48a', hair: '#3b5e2b', shirt: '#3f7a3a', pants: '#2d4a28', acc: 'hood', accColor: '#4f8f45' },
  offset: { skin: '#c68642', hair: '#1f1f1f', shirt: '#1f3a6b', pants: '#1a1a2e', acc: 'captain', accColor: '#f5f5f5' },
  paxi: { skin: '#f1c27d', hair: '#7a5230', shirt: '#a8323a', pants: '#4a1f24', acc: 'crown', accColor: '#fbbf24' },
  guard: { skin: '#e8b88a', hair: '#444444', shirt: '#6b7280', pants: '#374151', acc: 'helmet', accColor: '#9ca3af' },
  vil1: { skin: '#f1c27d', hair: '#e0a030', shirt: '#e67e22', pants: '#5d4037', acc: 'none' },
  vil2: { skin: '#8d5524', hair: '#1a1a1a', shirt: '#16a085', pants: '#2c3e50', acc: 'none' },
  vil3: { skin: '#ffdbac', hair: '#a0522d', shirt: '#d35400', pants: '#34495e', acc: 'none', beard: true },
  vil4: { skin: '#e0ac69', hair: '#5d5d5d', shirt: '#8e44ad', pants: '#2d3436', acc: 'none' },
  sage: { skin: '#f3d1b0', hair: '#f5f5f5', shirt: '#555b6e', pants: '#3a3f4f', acc: 'none', beard: true },
  // Distrito del Tesoro
  idem: { skin: '#e8b88a', hair: '#1f1f1f', shirt: '#b8860b', pants: '#3f2d0a', acc: 'glasses' },
  hilda: { skin: '#c68642', hair: '#7c2d12', shirt: '#57534e', pants: '#292524', acc: 'apron', accColor: '#92400e' },
  jota: { skin: '#f1c27d', hair: '#334155', shirt: '#1e3a5f', pants: '#0f172a', acc: 'hood', accColor: '#1e40af' },
  tece: { skin: '#8d5524', hair: '#1a1a1a', shirt: '#b45309', pants: '#44403c', acc: 'scarf', accColor: '#f59e0b' },
  canaria: { skin: '#ffdbac', hair: '#facc15', shirt: '#ca8a04', pants: '#3f3f46', acc: 'hood', accColor: '#fde047' },
  estrella: { skin: '#e0ac69', hair: '#4c1d95', shirt: '#7e22ce', pants: '#3b0764', acc: 'crown', accColor: '#e9d5ff' },
}

export type Dir = 'down' | 'up' | 'side'

function drawCharFrame(look: Look, dir: Dir, frame: 0 | 1 | 2): HTMLCanvasElement {
  const { c, ctx } = canvas(16, 16)
  const P = (x: number, y: number, w: number, h: number, col: string) => px(ctx, x, y, w, h, col)
  const shoe = '#2a2235'
  // piernas
  if (dir === 'side') {
    if (frame === 1) {
      P(5, 12, 2, 2, look.pants)
      P(5, 14, 2, 1, shoe)
      P(9, 12, 2, 2, look.pants)
      P(9, 14, 2, 1, shoe)
    } else {
      P(6, 12, 2, 2, look.pants)
      P(6, 14, 2, 1, shoe)
      P(8, 12, 2, frame === 2 ? 1 : 2, look.pants)
      P(8, frame === 2 ? 13 : 14, 2, 1, shoe)
    }
  } else {
    const lh = frame === 1 ? 1 : 2
    const rh = frame === 2 ? 1 : 2
    P(5, 12, 2, lh, look.pants)
    P(5, 12 + lh, 2, 1, shoe)
    P(9, 12, 2, rh, look.pants)
    P(9, 12 + rh, 2, 1, shoe)
  }
  // cuerpo
  P(4, 7, 8, 4, look.shirt)
  P(4, 11, 8, 1, look.pants)
  if (dir === 'side') {
    const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0
    P(7 + swing, 8, 2, 3, shade(look.shirt, -0.18))
    P(7 + swing, 11, 2, 1, look.skin)
  } else {
    const sw = frame === 1 ? 1 : 0
    const sw2 = frame === 2 ? 1 : 0
    P(3, 7 + sw, 1, 3, look.shirt)
    P(3, 10 + sw, 1, 1, look.skin)
    P(12, 7 + sw2, 1, 3, look.shirt)
    P(12, 10 + sw2, 1, 1, look.skin)
  }
  // cabeza
  P(4, 2, 8, 5, look.skin)
  if (dir === 'up') {
    P(4, 1, 8, 6, look.hair)
  } else if (dir === 'down') {
    P(4, 1, 8, 2, look.hair)
    P(4, 3, 1, 2, look.hair)
    P(11, 3, 1, 2, look.hair)
    P(6, 4, 1, 1, OUT)
    P(9, 4, 1, 1, OUT)
    P(5, 5, 1, 1, shade(look.skin, 0.12))
    P(10, 5, 1, 1, shade(look.skin, 0.12))
  } else {
    P(4, 1, 8, 2, look.hair)
    P(4, 3, 3, 3, look.hair)
    P(10, 4, 1, 1, OUT)
  }
  if (look.beard && dir !== 'up') {
    if (dir === 'down') P(5, 5, 6, 2, look.hair === '#2b2b2b' ? '#2b2b2b' : look.hair)
    else P(8, 5, 4, 2, look.hair)
  }
  // accesorios
  const ac = look.accColor ?? '#ffffff'
  switch (look.acc) {
    case 'scarf':
      P(4, 7, 8, 1, ac)
      if (dir === 'down') P(10, 8, 1, 2, ac)
      else if (dir === 'side') P(3, 7, 2, 1, ac)
      else P(5, 8, 1, 2, ac)
      break
    case 'wizard':
      P(3, 2, 10, 1, ac)
      P(5, 0, 6, 2, ac)
      P(7, 0, 2, 1, shade(ac, 0.25))
      break
    case 'apron':
      if (dir === 'down') P(5, 8, 6, 4, ac)
      else if (dir === 'side') P(9, 8, 2, 4, ac)
      break
    case 'glasses':
      if (dir === 'down') {
        P(5, 4, 3, 1, '#334155')
        P(8, 4, 3, 1, '#334155')
        P(6, 4, 1, 1, '#e0f2fe')
        P(9, 4, 1, 1, '#e0f2fe')
      } else if (dir === 'side') P(9, 4, 3, 1, '#334155')
      break
    case 'hood':
      P(3, 1, 10, 2, ac)
      P(3, 3, 1, 4, ac)
      P(12, 3, 1, 4, ac)
      if (dir === 'up') P(4, 3, 8, 4, ac)
      break
    case 'captain':
      P(3, 1, 10, 2, ac)
      P(3, 2, 10, 1, '#1f2937')
      P(7, 1, 2, 1, '#fbbf24')
      break
    case 'crown':
      P(4, 0, 8, 2, ac)
      P(4, 0, 1, 1, ac)
      P(6, 0, 1, 1, '#ef4444')
      P(9, 0, 1, 1, '#3b82f6')
      break
    case 'helmet':
      P(4, 1, 8, 3, ac)
      P(4, 3, 8, 1, shade(ac, -0.3))
      break
  }
  outline(ctx)
  return c
}

function outline(ctx: Ctx) {
  const img = ctx.getImageData(0, 0, 16, 16)
  const d = img.data
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && d[(y * 16 + x) * 4 + 3] === 255
  const toFill: number[] = []
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (solid(x, y)) continue
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) toFill.push(y * 16 + x)
    }
  for (const i of toFill) {
    d[i * 4] = 0x1d
    d[i * 4 + 1] = 0x1a
    d[i * 4 + 2] = 0x2b
    d[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export const CHAR_FRAMES: [Dir, 0 | 1 | 2][] = [
  ['down', 0],
  ['down', 1],
  ['down', 2],
  ['up', 0],
  ['up', 1],
  ['up', 2],
  ['side', 0],
  ['side', 1],
  ['side', 2],
]

/** Hoja de personajes: una fila por personaje, 9 columnas de frames. */
function drawChars(): { canvas: HTMLCanvasElement; ids: string[] } {
  const ids = Object.keys(LOOKS)
  const { c, ctx } = canvas(16 * CHAR_FRAMES.length, 16 * ids.length)
  ids.forEach((id, row) => {
    CHAR_FRAMES.forEach(([dir, f], col) => ctx.drawImage(drawCharFrame(LOOKS[id], dir, f), col * 16, row * 16))
  })
  return { canvas: c, ids }
}

/** Retrato ampliado para los diálogos (data URL). */
const portraitCache = new Map<string, string>()
export function portrait(id: string, scale = 5): string {
  const key = `${id}@${scale}`
  if (portraitCache.has(key)) return portraitCache.get(key)!
  const look = LOOKS[id] ?? LOOKS.vil1
  const frame = drawCharFrame(look, 'down', 0)
  const { c, ctx } = canvas(16 * scale, 13 * scale)
  ctx.drawImage(frame, 0, 0, 16, 13, 0, 0, 16 * scale, 13 * scale)
  const url = c.toDataURL()
  portraitCache.set(key, url)
  return url
}

/* =========================== OBJETOS =========================== */
export const OBJ = {
  scroll: [0, 0, 16, 16],
  bubble: [16, 0, 16, 16],
  fog: [32, 0, 16, 16],
  sparkle: [48, 0, 8, 8],
  shadow: [48, 8, 12, 5],
  crystal: [64, 0, 16, 32],
  read: [80, 0, 16, 16],
  static: [96, 0, 16, 16],
  write: [112, 0, 16, 16],
  bot: [128, 0, 16, 16],
  coin: [80, 16, 16, 16],
  heart: [96, 16, 16, 16],
  book: [112, 16, 16, 16],
  crate: [128, 16, 16, 16],
} as const

function blob(ctx: Ctx, ox: number, oy: number, color: string, kind: 'read' | 'static' | 'write' | 'bot') {
  const P = (x: number, y: number, w: number, h: number, col: string) => px(ctx, ox + x, oy + y, w, h, col)
  if (kind === 'bot') {
    P(3, 5, 10, 9, color)
    P(7, 2, 2, 3, '#94a3b8')
    P(6, 1, 4, 1, '#fde047')
    P(4, 7, 3, 3, '#fde047')
    P(9, 7, 3, 3, '#fde047')
    P(5, 8, 1, 1, OUT)
    P(10, 8, 1, 1, OUT)
    P(5, 11, 6, 1, OUT)
  } else {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(ox + 8, oy + 9.5, 6, 0, Math.PI * 2)
    ctx.fill()
    P(4, 13, 8, 2, color)
    P(5, 5, 2, 2, shade(color, 0.45))
    P(5, 8, 2, 3, '#ffffff')
    P(9, 8, 2, 3, '#ffffff')
    P(6, 9, 1, 2, OUT)
    P(10, 9, 1, 2, OUT)
    if (kind === 'write') {
      P(4, 7, 3, 1, OUT)
      P(9, 7, 3, 1, OUT)
    }
    if (kind === 'static') {
      P(2, 3, 1, 3, '#ffffff')
      P(1, 4, 3, 1, '#ffffff')
      P(13, 2, 1, 1, '#ffffff')
    }
  }
}

function drawObjects(): HTMLCanvasElement {
  const { c, ctx } = canvas(144, 32)
  // pergamino
  px(ctx, 2, 4, 12, 9, '#f5e6c4')
  px(ctx, 2, 4, 12, 1, '#fff7e0')
  px(ctx, 1, 3, 2, 11, '#d9c08c')
  px(ctx, 13, 3, 2, 11, '#d9c08c')
  px(ctx, 4, 6, 8, 1, '#a0855a')
  px(ctx, 4, 8, 6, 1, '#a0855a')
  px(ctx, 4, 10, 7, 1, '#a0855a')
  px(ctx, 7, 12, 2, 3, '#dc2626')
  // burbuja "!"
  px(ctx, 18, 1, 12, 10, '#ffffff')
  px(ctx, 17, 2, 14, 8, '#ffffff')
  px(ctx, 21, 11, 3, 2, '#ffffff')
  px(ctx, 23, 3, 2, 4, '#f59e0b')
  px(ctx, 23, 8, 2, 1, '#f59e0b')
  // niebla
  {
    const r = makeRng(77)
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * 16)
      const y = Math.floor(r() * 16)
      ctx.fillStyle = `rgba(${150 + Math.floor(r() * 60)}, ${120 + Math.floor(r() * 40)}, 220, ${0.35 + r() * 0.4})`
      ctx.fillRect(32 + x, y, 2, 2)
    }
  }
  // destello
  px(ctx, 51, 0, 2, 8, '#ffffff')
  px(ctx, 48, 3, 8, 2, '#ffffff')
  px(ctx, 51, 3, 2, 2, '#7ef0ff')
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.ellipse(54, 10.5, 6, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  // cristal 16x32
  {
    const o = 64
    const pts: [number, number][] = [
      [8, 1],
      [14, 10],
      [11, 30],
      [5, 30],
      [2, 10],
    ]
    ctx.fillStyle = '#38bdf8'
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(o + x, y) : ctx.moveTo(o + x, y)))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#7ef0ff'
    ctx.beginPath()
    ctx.moveTo(o + 8, 1)
    ctx.lineTo(o + 8, 30)
    ctx.lineTo(o + 5, 30)
    ctx.lineTo(o + 2, 10)
    ctx.closePath()
    ctx.fill()
    px(ctx, o + 5, 6, 2, 6, '#e0fdff')
    px(ctx, o + 10, 14, 1, 8, '#0ea5e9')
  }
  blob(ctx, 80, 0, '#3b82f6', 'read')
  blob(ctx, 96, 0, '#eab308', 'static')
  blob(ctx, 112, 0, '#ef4444', 'write')
  blob(ctx, 128, 0, '#a855f7', 'bot')
  // moneda
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(88, 24, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fde047'
  ctx.beginPath()
  ctx.arc(87.5, 23.5, 4.5, 0, Math.PI * 2)
  ctx.fill()
  px(ctx, 87, 21, 2, 6, '#f59e0b')
  // corazón
  for (const [x, y, w] of [[98, 19, 4], [104, 19, 4], [97, 20, 12], [97, 22, 12], [98, 24, 10], [100, 26, 6], [102, 28, 2]] as [number, number, number][]) px(ctx, x, y, w, 2, '#ef4444')
  px(ctx, 99, 20, 2, 2, '#fca5a5')
  // libro
  px(ctx, 115, 19, 10, 12, '#7c3aed')
  px(ctx, 115, 19, 2, 12, '#5b21b6')
  px(ctx, 118, 22, 5, 1, '#fde68a')
  px(ctx, 124, 20, 1, 10, '#f5f5f5')
  // caja
  px(ctx, 130, 19, 12, 11, '#b07a43')
  px(ctx, 130, 19, 12, 2, '#cf9a5f')
  px(ctx, 130, 24, 12, 1, '#7d5530')
  px(ctx, 135, 19, 2, 11, '#7d5530')
  return c
}

/* =========================== EXPORT =========================== */
export interface GeneratedArt {
  tiles: HTMLCanvasElement
  chars: HTMLCanvasElement
  charIds: string[]
  objects: HTMLCanvasElement
}

let cached: GeneratedArt | null = null
export function generateArt(): GeneratedArt {
  if (cached) return cached
  const { canvas: chars, ids } = drawChars()
  cached = { tiles: drawTiles(), chars, charIds: ids, objects: drawObjects() }
  return cached
}
