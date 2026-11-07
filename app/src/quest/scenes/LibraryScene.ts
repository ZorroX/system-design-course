import * as Phaser from 'phaser'
import { BasePuzzle, COLORS, type Button } from './BasePuzzle'
import { LIB_L1, LIB_L2_K, LIB_L2_TARGET, beladyHits, bestVictim, libL2Sequence, type Policy } from '../models/library'
import { makeRng } from '../models/rng'
import { chip } from '../audio'

const BOOK_COLORS: Record<string, number> = { A: 0xef4444, B: 0x3b82f6, C: 0x22c55e, D: 0xeab308, E: 0xa855f7, F: 0xf97316, G: 0x14b8a6, H: 0xec4899, I: 0x84cc16, J: 0x6366f1, K: 0xf43f5e, L: 0x0ea5e9 }
const SLOT_X = [175, 285, 395]
const SLOT_Y = 285
const ARCHIVE = { x: 655, y: 285 }

export class LibraryScene extends BasePuzzle {
  readonly puzzleId = 'library' as const
  private objs: Phaser.GameObjects.GameObject[] = []
  private buttons: Button[] = []
  private desk: (string | null)[] = []
  private deskCards: (Phaser.GameObjects.Container | null)[] = []
  private reqCards: Phaser.GameObjects.Container[] = []
  private idx = 0
  private hits = 0
  private misses = 0
  private awaiting = false
  private pending: string | null = null
  private flying: Phaser.GameObjects.Container | null = null
  private slotG!: Phaser.GameObjects.Graphics
  private stat!: Phaser.GameObjects.Text
  private msg!: Phaser.GameObjects.Text
  private l1Stars = 0
  private optimal = beladyHits(LIB_L1.seq, LIB_L1.k)
  private policyBtns: Partial<Record<Policy, Button>> = {}
  private running = false

  constructor() {
    super('library')
  }

  protected build() {
    this.startL1()
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T) {
    this.objs.push(o)
    return o
  }
  private clear() {
    this.objs.forEach((o) => o.destroy())
    this.objs = []
    this.buttons.forEach((b) => b.destroy())
    this.buttons = []
    this.deskCards.forEach((c) => c?.destroy())
    this.reqCards.forEach((c) => c.destroy())
    this.flying?.destroy()
    this.flying = null
    this.deskCards = []
    this.reqCards = []
    this.policyBtns = {}
  }

  private book(letter: string, w = 44, h = 56, extra = '') {
    const g = this.add.graphics()
    const col = BOOK_COLORS[letter] ?? 0x999999
    g.fillStyle(col, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 5)
    g.fillStyle(0x000000, 0.25).fillRect(-w / 2, -h / 2, 6, h)
    g.lineStyle(2, 0x1d1a2b, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 5)
    const t = this.txt(2, extra ? -6 : 0, letter, Math.round(h * 0.42), '#ffffff', { bold: true }).setOrigin(0.5)
    const items: Phaser.GameObjects.GameObject[] = [g, t]
    if (extra) items.push(this.txt(2, h / 2 - 12, extra, 11, '#ffffff').setOrigin(0.5))
    return this.add.container(0, 0, items)
  }

  private drawScenery(k: number) {
    this.keep(this.add.image(95, 318, 'objs', 'shadow').setScale(3))
    this.keep(this.add.image(95, 300, 'chars', 'lia_down0').setScale(3))
    this.keep(this.txt(95, 330, 'Lía', 12, COLORS.muted).setOrigin(0.5, 0))
    // escritorio
    this.keep(this.panel(118, 210, 334, 150, 0x3d2614, 1, 0x7a5a3a))
    this.keep(this.txt(285, 222, `Escritorio (caché) · ${k} huecos · instantáneo`, 13, '#fde68a', { bold: true }).setOrigin(0.5, 0))
    this.slotG = this.keep(this.add.graphics())
    // archivo
    const a = this.keep(this.add.graphics())
    a.fillStyle(0x1b2547, 1).fillRoundedRect(ARCHIVE.x - 80, ARCHIVE.y - 80, 160, 170, 10)
    for (let r = 0; r < 4; r++) {
      a.fillStyle(0x3d2614, 1).fillRect(ARCHIVE.x - 70, ARCHIVE.y - 70 + r * 40, 140, 30)
      for (let i = 0; i < 9; i++) a.fillStyle(Object.values(BOOK_COLORS)[(i + r * 3) % 12], 1).fillRect(ARCHIVE.x - 66 + i * 15, ARCHIVE.y - 66 + r * 40, 11, 24)
    }
    this.keep(this.txt(ARCHIVE.x, ARCHIVE.y + 98, 'Archivo (base de datos)\n1.000 escalones: lento', 12, COLORS.muted, { align: 'center' }).setOrigin(0.5, 0))
    this.stat = this.keep(this.txt(20, 400, '', 15, COLORS.text, { bold: true }))
    this.msg = this.keep(this.txt(20, 430, '', 14, COLORS.warnHex, { wrap: 760 }))
  }

  private drawSlots(pulse = false) {
    const g = this.slotG
    g.clear()
    for (let j = 0; j < SLOT_X.length; j++) {
      g.fillStyle(0x24170c, 1).fillRoundedRect(SLOT_X[j] - 45, SLOT_Y - 50, 90, 100, 8)
      const glow = pulse && this.awaiting ? 0.5 + 0.5 * Math.sin(this.time.now / 140) : 0
      g.lineStyle(pulse && this.awaiting ? 3 : 1.5, pulse && this.awaiting ? 0xf87171 : 0x7a5a3a, pulse && this.awaiting ? 0.5 + glow * 0.5 : 1).strokeRoundedRect(SLOT_X[j] - 45, SLOT_Y - 50, 90, 100, 8)
    }
  }

  /* ============================ NIVEL 1 ============================ */
  private async startL1() {
    this.clear()
    this.idx = 0
    this.hits = 0
    this.misses = 0
    this.awaiting = false
    this.desk = [null, null, null]
    this.deskCards = [null, null, null]
    this.drawScenery(LIB_L1.k)
    this.keep(this.txt(20, 58, 'Fila de lectores (cada uno pide un libro, en este orden):', 13, COLORS.muted))
    LIB_L1.seq.forEach((b, i) => {
      const c = this.book(b, 40, 50)
      c.setPosition(52 + i * 50, 112)
      this.reqCards.push(c)
    })
    for (let j = 0; j < 3; j++) {
      const z = this.keep(this.add.zone(SLOT_X[j], SLOT_Y, 90, 100).setInteractive({ useHandCursor: true }))
      z.on('pointerdown', () => this.evict(j))
    }
    this.updateStat()
    await this.brief({
      title: 'Nivel 1 · El escritorio de Lía',
      icon: '📚',
      goal: `Consigue ${this.optimal} aciertos (el máximo posible) en 14 peticiones.`,
      how: [
        'Si el libro pedido ya está en el escritorio: ¡acierto inmediato!',
        'Si no, Lía baja al archivo. Si el escritorio está lleno, TÚ eliges qué libro devolver.',
        'Puedes ver toda la fila de lectores: aprovecha que conoces el futuro.',
      ],
      concept: `El escritorio es una caché de 3 huecos. ¿Qué conviene expulsar? Pista: piensa en el libro que más tardará en volver a pedirse. ★★★ = ${this.optimal}, ★★ = ${this.optimal - 1}, ★ = ${this.optimal - 2}.`,
      button: 'Abrir la biblioteca',
    })
    this.time.delayedCall(300, () => this.next())
  }

  private updateStat() {
    this.stat.setText(`Aciertos: ${this.hits}   ·   Fallos: ${this.misses}   ·   Petición ${Math.min(this.idx + 1, LIB_L1.seq.length)}/${LIB_L1.seq.length}   ·   Óptimo posible: ${this.optimal}`)
  }

  private mark(i: number, ok: boolean) {
    const c = this.reqCards[i]
    c.setAlpha(0.45)
    const t = this.txt(c.x, c.y + 38, ok ? '✓' : '✗', 18, ok ? COLORS.goodHex : COLORS.badHex, { bold: true }).setOrigin(0.5)
    this.keep(t)
  }

  private next() {
    if (this.idx >= LIB_L1.seq.length) return this.endL1()
    this.reqCards.forEach((c, i) => c.setScale(i === this.idx ? 1.15 : 1))
    const b = LIB_L1.seq[this.idx]
    const slot = this.desk.indexOf(b)
    if (slot >= 0) {
      this.hits++
      chip.sfx('coin')
      this.mark(this.idx, true)
      const card = this.deskCards[slot]!
      this.tweens.add({ targets: card, y: SLOT_Y - 14, duration: 140, yoyo: true })
      this.floatText(SLOT_X[slot], SLOT_Y - 70, '¡Acierto!', COLORS.goodHex)
      this.idx++
      this.updateStat()
      this.time.delayedCall(650, () => this.next())
      return
    }
    this.misses++
    chip.sfx('step')
    this.mark(this.idx, false)
    this.updateStat()
    // el libro sube desde el archivo
    const card = this.book(b, 60, 78)
    card.setPosition(ARCHIVE.x, ARCHIVE.y)
    this.flying = card
    this.tweens.add({
      targets: card,
      x: 285,
      y: 170,
      duration: 500,
      ease: 'Cubic.out',
      onComplete: () => {
        const free = this.desk.indexOf(null)
        if (free >= 0) this.place(free, b)
        else {
          this.awaiting = true
          this.pending = b
          this.msg.setText(`El escritorio está lleno. Toca el libro que vuelve al archivo para hacer sitio a "${b}".`)
        }
      },
    })
  }

  private place(j: number, b: string) {
    const card = this.flying!
    this.flying = null
    this.desk[j] = b
    this.deskCards[j] = card
    this.tweens.add({ targets: card, x: SLOT_X[j], y: SLOT_Y, duration: 260, ease: 'Back.out' })
    this.idx++
    this.time.delayedCall(700, () => this.next())
  }

  private evict(j: number) {
    if (!this.awaiting || !this.pending) return
    const victim = this.desk[j]!
    const best = bestVictim(this.desk as string[], LIB_L1.seq, this.idx)
    const nextUse = (x: string) => {
      const n = LIB_L1.seq.indexOf(x, this.idx + 1)
      return n === -1 ? Infinity : n
    }
    if (victim !== best && nextUse(victim) < nextUse(best)) {
      const when = nextUse(best) === Infinity ? 'no se vuelve a pedir' : `no se pide hasta la posición ${nextUse(best) + 1}`
      this.msg.setText(`Hmm… "${victim}" se vuelve a pedir pronto (posición ${nextUse(victim) + 1}). "${best}" ${when}: era mejor devolverlo.`)
    } else this.msg.setText(`Buena elección: "${victim}" ${nextUse(victim) === Infinity ? 'no se vuelve a pedir' : 'era el que más tardaba en volver'}.`)
    const old = this.deskCards[j]!
    this.tweens.add({ targets: old, x: ARCHIVE.x, y: ARCHIVE.y, alpha: 0, duration: 450, onComplete: () => old.destroy() })
    this.awaiting = false
    const b = this.pending
    this.pending = null
    this.place(j, b)
  }

  private endL1() {
    const s = this.hits >= this.optimal ? 3 : this.hits === this.optimal - 1 ? 2 : this.hits === this.optimal - 2 ? 1 : 0
    if (s === 0) return this.levelFailed(`Lograste ${this.hits} aciertos (necesitas al menos ${this.optimal - 2}). Antes de devolver un libro, mira la fila: ¿cuál tarda más en volver a pedirse?`, () => this.startL1())
    this.l1Stars = s
    this.levelDone(s, 2, () => this.startL2(), `${this.hits} aciertos de ${this.optimal} posibles. Expulsar el libro que más tarda en volver es el algoritmo óptimo de Bélády… pero solo funciona si conoces el futuro.`)
  }

  /* ============================ NIVEL 2 ============================ */
  private async startL2() {
    this.clear()
    this.desk = Array(LIB_L2_K).fill(null)
    this.deskCards = Array(LIB_L2_K).fill(null)
    this.drawScenery(LIB_L2_K)
    this.keep(this.txt(20, 58, 'Ahora NO ves la fila. Elige una política para que Lía decida sola:', 13, COLORS.muted))
    const policies: [Policy, string][] = [
      ['LRU', 'LRU · la menos reciente'],
      ['LFU', 'LFU · la menos usada'],
      ['FIFO', 'FIFO · la más antigua'],
      ['RANDOM', 'Al azar'],
    ]
    policies.forEach(([p, label], i) => {
      const b = this.button(110 + i * 193, 100, 180, 36, label, () => this.runPolicy(p), { color: COLORS.panel2, size: 13 })
      this.buttons.push(b)
      this.policyBtns[p] = b
    })
    this.stat.setText(`Meta: al menos ${LIB_L2_TARGET} aciertos en ${libL2Sequence().length} peticiones.`)
    await this.brief({
      title: 'Nivel 2 · El inventario anual',
      icon: '🗂️',
      goal: `Elige la política de expulsión que logre al menos ${LIB_L2_TARGET} aciertos.`,
      how: [
        'Lía ya no ve el futuro: decide sola con la política que elijas.',
        'Los lectores piden casi siempre los libros A y B…',
        '…pero de vez en cuando llega el "inventario anual": una ráfaga de libros que se piden UNA sola vez.',
      ],
      concept: 'Sin conocer el futuro, las políticas reales aproximan a Bélády: [[lru|LRU]] usa la recencia; LFU, la frecuencia. Una ráfaga de datos que se leen una sola vez se llama "escaneo".',
      button: 'Elegir política',
    })
  }

  private runPolicy(p: Policy) {
    if (this.running) return
    this.running = true
    Object.values(this.policyBtns).forEach((b) => b?.setEnabled(false))
    this.policyBtns[p]?.setSelected(true)
    this.deskCards.forEach((c) => c?.destroy())
    this.deskCards = Array(LIB_L2_K).fill(null)
    this.reqCards.forEach((c) => c.destroy())
    this.reqCards = []
    const seq = libL2Sequence()
    const rnd = makeRng(3)
    const desk: { b: string; last: number; freq: number; ins: number; slot: number }[] = []
    let hits = 0
    let t = 0
    const step = () => {
      if (t >= seq.length) return done()
      const b = seq[t]
      const dot = this.book(b, 18, 24)
      dot.setPosition(30 + t * 24, 160)
      this.reqCards.push(dot)
      const e = desk.find((x) => x.b === b)
      if (e) {
        hits++
        e.last = t
        e.freq++
        const c = this.deskCards[e.slot]!
        this.tweens.add({ targets: c, y: SLOT_Y - 12, duration: 70, yoyo: true })
        this.refreshCard(e.slot, e.b, e.freq)
        dot.add(this.txt(0, 18, '✓', 12, COLORS.goodHex, { bold: true }).setOrigin(0.5))
      } else {
        dot.add(this.txt(0, 18, '✗', 12, COLORS.badHex, { bold: true }).setOrigin(0.5))
        let slot = desk.length
        if (desk.length >= LIB_L2_K) {
          let vi = 0
          if (p === 'LRU') vi = desk.reduce((bi, x, i) => (x.last < desk[bi].last ? i : bi), 0)
          if (p === 'LFU') vi = desk.reduce((bi, x, i) => (x.freq < desk[bi].freq || (x.freq === desk[bi].freq && x.last < desk[bi].last) ? i : bi), 0)
          if (p === 'FIFO') vi = desk.reduce((bi, x, i) => (x.ins < desk[bi].ins ? i : bi), 0)
          if (p === 'RANDOM') vi = Math.floor(rnd() * desk.length)
          slot = desk[vi].slot
          desk.splice(vi, 1)
        }
        desk.push({ b, last: t, freq: 1, ins: t, slot })
        this.refreshCard(slot, b, 1)
      }
      this.stat.setText(`Política ${p} · Aciertos: ${hits} / meta ${LIB_L2_TARGET} · Petición ${t + 1}/${seq.length}`)
      t++
      this.time.delayedCall(170, step)
    }
    const done = () => {
      this.running = false
      Object.values(this.policyBtns).forEach((b) => b?.setEnabled(true))
      this.policyBtns[p]?.setSelected(false)
      if (hits >= LIB_L2_TARGET) {
        this.levelDone(this.l1Stars, 2, () => {}, `${p} logró ${hits} aciertos. LFU protege a A y B gracias a su frecuencia: los libros del inventario (pedidos una sola vez) entran y salen sin desplazarlos. En la vida real se usan mezclas como W-TinyLFU.`)
      } else {
        const why =
          p === 'LRU'
            ? 'LRU expulsa lo menos reciente: durante el inventario (D, E, F…) A y B parecen "viejos" y salen del escritorio.'
            : p === 'FIFO'
              ? 'FIFO expulsa al que entró primero, aunque sea el más popular.'
              : 'Al azar no aprovecha que A y B son muy populares.'
        this.msg.setText(`${p}: ${hits} aciertos (meta ${LIB_L2_TARGET}). ${why} Prueba otra política.`)
        chip.sfx('bad')
      }
    }
    step()
  }

  private refreshCard(slot: number, b: string, freq: number) {
    this.deskCards[slot]?.destroy()
    const c = this.book(b, 64, 82, `usos: ${freq}`)
    c.setPosition(SLOT_X[slot], SLOT_Y)
    this.deskCards[slot] = c
  }

  update() {
    if (this.slotG) this.drawSlots(true)
  }
}
