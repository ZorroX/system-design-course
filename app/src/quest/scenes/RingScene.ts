import * as Phaser from 'phaser'
import { BasePuzzle, COLORS, type Button } from './BasePuzzle'
import { ORBS, RING_LEVELS, SLOTS, heirsIfRemoved, loads, ownerOf, type Token } from '../models/ring'
import { chip } from '../audio'

const C = { x: 280, y: 285 }
const R_SLOT = 168
const R_ORB = 126
const CUST = [
  { name: 'Roja', color: 0xef4444, hex: '#f87171' },
  { name: 'Verde', color: 0x22c55e, hex: '#4ade80' },
  { name: 'Azul', color: 0x3b82f6, hex: '#60a5fa' },
  { name: 'Amarilla', color: 0xeab308, hex: '#facc15' },
]
const ang = (p: number) => (-90 + p * (360 / SLOTS)) * (Math.PI / 180)
const at = (p: number, r: number) => ({ x: C.x + Math.cos(ang(p)) * r, y: C.y + Math.sin(ang(p)) * r })

export class RingScene extends BasePuzzle {
  readonly puzzleId = 'ring' as const
  private level = 0
  private tokens: Token[] = []
  private active = 0
  private objs: Phaser.GameObjects.GameObject[] = []
  private buttons: Button[] = []
  private g!: Phaser.GameObjects.Graphics
  private rows: { name: Phaser.GameObjects.Text; info: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = []
  private msg!: Phaser.GameObjects.Text
  private extra!: Phaser.GameObjects.Text
  private doneBtn?: Button
  private solved = false
  private ghost: number | null = null // custodio "caído" simulado

  constructor() {
    super('ring')
  }

  protected build() {
    this.startLevel(0)
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T) {
    this.objs.push(o)
    return o
  }

  private async startLevel(i: number) {
    this.objs.forEach((o) => o.destroy())
    this.objs = []
    this.buttons.forEach((b) => b.destroy())
    this.buttons = []
    this.rows = []
    this.doneBtn = undefined
    this.solved = false
    this.ghost = null
    this.level = i
    const L = RING_LEVELS[i]
    this.tokens = L.locked.map((t) => ({ ...t }))
    this.active = L.locked.length ? L.custodians - 1 : 0

    this.g = this.keep(this.add.graphics())
    for (let s = 0; s < SLOTS; s++) {
      const p = at(s, R_SLOT)
      const z = this.keep(this.add.zone(p.x, p.y, 30, 30).setInteractive({ useHandCursor: true }))
      z.on('pointerdown', () => this.clickSlot(s))
    }
    this.keep(this.txt(C.x, C.y - 10, '🌳', 34).setOrigin(0.5))
    this.keep(this.txt(C.x, C.y + 24, 'Cada orbe es del primer\ncustodio en sentido horario', 11, COLORS.muted, { align: 'center' }).setOrigin(0.5))

    // panel derecho
    this.keep(this.panel(500, 56, 288, 432, COLORS.panel, 0.95))
    this.keep(this.txt(516, 70, `Nivel ${i + 1}/3 · ${L.title}`, 15, COLORS.accentHex, { bold: true }))
    for (let c = 0; c < L.custodians; c++) {
      const y = 108 + c * 46
      const zone = this.keep(this.add.zone(644, y + 14, 270, 40).setInteractive({ useHandCursor: true }))
      zone.on('pointerdown', () => {
        if (this.isLockedCustodian(c)) return
        this.active = c
        chip.sfx('talk')
      })
      const name = this.keep(this.txt(546, y + 4, '', 14, CUST[c].hex, { bold: true }))
      const info = this.keep(this.txt(546, y + 22, '', 12, COLORS.muted))
      this.rows.push({ name, info, zone })
    }
    const yAfter = 108 + L.custodians * 46 + 6
    this.msg = this.keep(this.txt(516, yAfter, '', 13, COLORS.text, { wrap: 258 }))
    this.extra = this.keep(this.txt(516, yAfter + 92, '', 12, COLORS.muted, { wrap: 258 }))
    this.buttons.push(this.button(572, 470, 120, 30, '↺ Reiniciar', () => this.reset(), { color: COLORS.panel2, size: 13 }))
    if (i === 2) {
      ;[0, 1, 2].forEach((c) => {
        const b = this.button(560 + c * 74, 430, 68, 28, `💀 ${CUST[c].name}`, () => this.simulateFall(c), { color: COLORS.panel2, size: 11 })
        this.buttons.push(b)
      })
      this.keep(this.txt(516, 404, 'Simular la caída de un custodio:', 12, COLORS.muted))
    }

    const briefs = [
      {
        title: 'Nivel 1 · Reparto justo',
        goal: 'Coloca 3 custodios para que cada uno guarde exactamente 4 orbes.',
        how: ['Toca un punto del anillo para colocar al custodio seleccionado (toca otra vez para quitarlo).', 'Cada orbe pertenece al primer custodio que encuentra girando en el sentido de las agujas del reloj.', 'Selecciona otro custodio en el panel derecho.'],
        concept: 'Esto es [[consistent-hashing|consistent hashing]]: los nodos y las claves viven en el mismo anillo de hashes.',
      },
      {
        title: 'Nivel 2 · Llega un custodio nuevo',
        goal: 'La Roja guarda 7 orbes. Coloca a la Amarilla para que nadie guarde más de 4, moviendo los mínimos orbes posibles.',
        how: ['Los custodios Roja, Verde y Azul ya están fijos.', 'La Amarilla solo "roba" orbes del tramo donde la pongas.', '3★ si mueves el mínimo posible de orbes.'],
        concept: 'Con hash % N, pasar de 3 a 4 nodos movería casi todas las claves. En el anillo solo se mueven las de un tramo: por eso las cachés distribuidas lo usan.',
      },
      {
        title: 'Nivel 3 · Nodos virtuales',
        goal: 'Cada custodio pone 2 marcas. Logra 4 orbes por custodio Y que, si cae cualquiera, sus orbes se repartan entre los otros dos.',
        how: ['Cada custodio tiene 2 marcas (2 posiciones en el anillo).', 'Usa los botones "Simular la caída" para ver a quién pasan sus orbes.', 'Pista: intercala bien los colores.'],
        concept: 'Los [[vnode|nodos virtuales]] son eso: varias posiciones por nodo. Equilibran la carga y reparten el impacto cuando un nodo falla.',
      },
    ]
    await this.brief({ ...briefs[i], icon: '💍', button: 'Al anillo' })
  }

  private isLockedCustodian(c: number) {
    return RING_LEVELS[this.level].locked.some((t) => t.owner === c)
  }

  private clickSlot(s: number) {
    if (this.solved || this.paused) return
    const L = RING_LEVELS[this.level]
    const existing = this.tokens.find((t) => t.slot === s)
    if (existing) {
      if (existing.locked) return
      this.tokens = this.tokens.filter((t) => t !== existing)
      chip.sfx('step')
      return
    }
    const mine = this.tokens.filter((t) => t.owner === this.active && !t.locked).length
    if (mine >= L.tokensPerCustodian) {
      // mover: quita la marca más antigua del custodio activo
      const idx = this.tokens.findIndex((t) => t.owner === this.active && !t.locked)
      this.tokens.splice(idx, 1)
    }
    this.tokens.push({ slot: s, owner: this.active })
    chip.sfx('build')
    // si el custodio activo ya colocó todas sus marcas, pasa al siguiente que tenga pendientes
    const full = (c: number) => this.tokens.filter((t) => t.owner === c).length >= L.tokensPerCustodian
    if (full(this.active)) {
      for (let k = 1; k < L.custodians; k++) {
        const c = (this.active + k) % L.custodians
        if (!this.isLockedCustodian(c) && !full(c)) {
          this.active = c
          break
        }
      }
    }
  }

  private reset() {
    this.tokens = RING_LEVELS[this.level].locked.map((t) => ({ ...t }))
    this.solved = false
    this.doneBtn?.destroy()
    this.doneBtn = undefined
  }

  private simulateFall(c: number) {
    if (this.tokens.length < 2) return
    this.ghost = c
    chip.sfx('bad')
    this.time.delayedCall(1800, () => (this.ghost = null))
  }

  update() {
    if (!this.g) return
    const L = RING_LEVELS[this.level]
    const g = this.g
    g.clear()
    const tokens = this.ghost !== null ? this.tokens.filter((t) => t.owner !== this.ghost) : this.tokens
    // arcos de propiedad
    const sorted = [...tokens].sort((a, b) => a.slot - b.slot)
    g.lineStyle(6, 0x26315a, 1).strokeCircle(C.x, C.y, R_SLOT)
    sorted.forEach((t, i) => {
      const prev = sorted[(i - 1 + sorted.length) % sorted.length]
      let from = prev.slot
      const to = t.slot
      if (sorted.length === 1 || from >= to) from -= SLOTS
      g.lineStyle(8, CUST[t.owner].color, 0.35)
      g.beginPath()
      g.arc(C.x, C.y, R_SLOT, ang(from), ang(to), false)
      g.strokePath()
    })
    // posiciones
    for (let s = 0; s < SLOTS; s++) {
      const p = at(s, R_SLOT)
      const tok = this.tokens.find((t) => t.slot === s)
      if (tok) {
        const dead = this.ghost === tok.owner
        g.fillStyle(CUST[tok.owner].color, dead ? 0.2 : 1).fillCircle(p.x, p.y, 12)
        g.lineStyle(2, tok.locked ? 0xffffff : 0x1d1a2b, 1).strokeCircle(p.x, p.y, 12)
        if (tok.locked) g.fillStyle(0xffffff, 0.9).fillCircle(p.x, p.y, 3)
      } else {
        g.fillStyle(0x1b2547, 1).fillCircle(p.x, p.y, 6)
        g.lineStyle(1.5, 0x3b4a80, 1).strokeCircle(p.x, p.y, 6)
      }
    }
    // orbes
    const pulse = this.solved ? 1 + 0.15 * Math.sin(this.time.now / 120) : 1
    for (const o of ORBS) {
      const p = at(o, R_ORB)
      const w = ownerOf(tokens, o)
      const col = w >= 0 ? CUST[w].color : 0x8f9bbd
      g.fillStyle(col, 0.25).fillCircle(p.x, p.y, 12 * pulse)
      g.fillStyle(col, 1).fillCircle(p.x, p.y, 7 * pulse)
      g.fillStyle(0xffffff, 0.7).fillCircle(p.x - 2, p.y - 2, 2)
    }
    // panel
    const ld = loads(this.tokens, L.custodians)
    this.rows.forEach((r, c) => {
      const placed = this.tokens.filter((t) => t.owner === c).length
      const locked = this.isLockedCustodian(c)
      r.name.setText(`${this.active === c && !locked ? '▶ ' : ''}Custodia ${CUST[c].name}${locked ? ' (fija)' : ''}`)
      r.info.setText(`marcas ${placed}/${L.tokensPerCustodian} · guarda ${ld[c]} orbe${ld[c] === 1 ? '' : 's'}`)
    })
    const res = L.check(this.tokens)
    if (this.ghost !== null) {
      const heirs = heirsIfRemoved(this.tokens, this.ghost)
      this.msg.setText(`Si cae la ${CUST[this.ghost].name}, sus orbes pasan a: ${[...heirs].filter((h) => h >= 0).map((h) => CUST[h].name).join(' y ') || 'nadie'}.`)
    } else this.msg.setText(res.msg)
    if (this.level === 1) {
      const added = this.tokens.filter((t) => !t.locked)
      const moved = added.length ? ORBS.filter((o) => ownerOf(L.locked, o) !== ownerOf(this.tokens, o)).length : 0
      this.extra.setText(`Orbes que cambian de dueño: ${moved}\nCon hash % N (3 → 4 custodios) cambiarían ~9 de 12.`)
    }
    if (res.ok && !this.solved) {
      this.solved = true
      chip.sfx('ok')
      this.doneBtn = this.button(714, 470, 136, 30, 'Continuar ✓', () => {
        const r = RING_LEVELS[this.level].check(this.tokens)
        if (r.ok) this.levelDone(r.stars, 3, () => this.startLevel(this.level + 1), r.msg)
      }, { size: 13 })
      this.buttons.push(this.doneBtn)
    } else if (!res.ok && this.solved) {
      this.solved = false
      this.doneBtn?.destroy()
      this.doneBtn = undefined
    }
  }
}
