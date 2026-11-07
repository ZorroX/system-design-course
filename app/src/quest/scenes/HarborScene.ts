import * as Phaser from 'phaser'
import { BasePuzzle, COLORS, type Button } from './BasePuzzle'
import { HARBOR_L1, HARBOR_L2, HarborManual, HarborStorm, MERCHANT_COLORS, MERCHANT_NAMES } from '../models/harbor'
import { chip } from '../audio'

const LANE_Y = [150, 262, 374]
const BELT_X0 = 200
const BELT_X1 = 628
const WORKER_X = 668

export class HarborScene extends BasePuzzle {
  readonly puzzleId = 'harbor' as const
  private objs: Phaser.GameObjects.GameObject[] = []
  private buttons: Button[] = []
  private level = 0
  private acc = 0
  private running = false
  private l1!: HarborManual
  private storm: HarborStorm | null = null
  private crates = new Map<number, { c: Phaser.GameObjects.Container; x: number; y: number; gone: number }>()
  private g!: Phaser.GameObjects.Graphics
  private stat!: Phaser.GameObjects.Text
  private legend: Phaser.GameObjects.Text[] = []
  private lanes = 4
  private workers = 4
  private cfgText?: Phaser.GameObjects.Text
  private l1Stars = 0
  private stormTexts: Phaser.GameObjects.Text[] = []
  private poolIdx = 0

  constructor() {
    super('harbor')
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
    this.crates.forEach((c) => c.c.destroy())
    this.crates.clear()
    this.legend = []
    this.stormTexts.forEach((t) => t.destroy())
    this.stormTexts = []
    this.storm = null
    this.running = false
    this.acc = 0
  }

  private crate(merchant: number, label: string, heavy = false, size = 46) {
    const g = this.add.graphics()
    const s = heavy ? size + 6 : size
    g.fillStyle(MERCHANT_COLORS[merchant], 1).fillRoundedRect(-s / 2, -s / 2, s, s, 6)
    g.lineStyle(heavy ? 4 : 2, heavy ? 0x1d1a2b : 0x000000, heavy ? 1 : 0.35).strokeRoundedRect(-s / 2, -s / 2, s, s, 6)
    g.lineStyle(2, 0x000000, 0.2).lineBetween(-s / 2 + 4, 0, s / 2 - 4, 0)
    const items: Phaser.GameObjects.GameObject[] = [g, this.txt(0, heavy ? -6 : 0, label, Math.round(size * 0.36), '#ffffff', { bold: true }).setOrigin(0.5)]
    if (heavy) items.push(this.txt(0, 14, 'pesada', 10, '#ffffff').setOrigin(0.5))
    return this.add.container(0, 0, items)
  }

  /* ============================ NIVEL 1 ============================ */
  private async startL1() {
    this.clear()
    this.level = 0
    this.l1 = new HarborManual()
    this.drawDock(3)
    this.g = this.keep(this.add.graphics())
    this.stat = this.keep(this.txt(20, 58, '', 14, COLORS.text, { bold: true }))
    LANE_Y.forEach((y, l) => {
      const z = this.keep(this.add.zone((BELT_X0 + BELT_X1) / 2 - 30, y, BELT_X1 - BELT_X0 + 60, 70).setInteractive({ useHandCursor: true }))
      z.on('pointerdown', () => {
        if (!this.running || this.paused) return
        if (this.l1.send(l)) chip.sfx('talk')
      })
      this.keep(this.txt(BELT_X0 + 6, y - 44, `Carril ${l + 1}`, 12, COLORS.muted))
    })
    // leyenda de mercaderes
    for (let m = 0; m < HARBOR_L1.merchants; m++) {
      const x = 20 + m * 128
      this.keep(this.add.rectangle(x + 8, 470, 14, 14, MERCHANT_COLORS[m]))
      this.legend.push(this.keep(this.txt(x + 20, 462, '', 12, COLORS.text)))
    }
    await this.brief({
      title: 'Nivel 1 · Orden en el muelle',
      icon: '⚓',
      goal: 'Entrega las 24 cajas sin desorden y sin perder ninguna (1 error = ★★).',
      how: [
        'Llega una caja al muelle: toca un CARRIL para mandarla. Cada carril tiene un estibador que despacha en orden de llegada.',
        'Las cajas de un mismo mercader (mismo color) están numeradas 1, 2, 3, 4: deben despacharse en ese orden.',
        'Las cajas pesadas tardan 4 veces más. Si un carril va lento, una caja posterior de otro carril puede adelantarse… ¡desorden!',
        'Si dejas acumular más de 3 cajas en el muelle o llenas un carril (6), se caen al agua.',
      ],
      concept: 'Cada carril es una partición de [[kafka|Kafka]] y el color es la clave del mensaje. El orden solo se garantiza dentro de una partición.',
      button: 'Abrir el muelle',
    })
    this.running = true
  }

  private drawDock(lanes: number) {
    const g = this.keep(this.add.graphics())
    g.fillStyle(0x1e3a5f, 1).fillRect(0, 92, 110, 380) // agua
    g.fillStyle(0x9a6b3f, 1).fillRect(110, 92, 70, 380) // muelle
    for (let y = 100; y < 470; y += 14) g.fillStyle(0x7a522d, 1).fillRect(110, y, 70, 2)
    // barco
    const ship = this.keep(this.add.graphics())
    ship.fillStyle(0x7a4e2c, 1).fillTriangle(10, 250, 100, 250, 85, 285).fillRect(10, 238, 90, 14)
    ship.fillStyle(0xf5f5f5, 1).fillTriangle(52, 160, 52, 232, 92, 232)
    ship.fillStyle(0x6b4a2b, 1).fillRect(50, 158, 4, 82)
    this.tweens.add({ targets: ship, y: 4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    if (lanes === 3) {
      for (const y of LANE_Y) {
        g.fillStyle(0x2a3350, 1).fillRoundedRect(BELT_X0, y - 30, BELT_X1 - BELT_X0, 60, 8)
        for (let x = BELT_X0 + 10; x < BELT_X1; x += 24) g.fillStyle(0x3b4a80, 1).fillRect(x, y + 26, 12, 3)
      }
    }
  }

  private intakePos(k: number) {
    return { x: 145, y: 170 + k * 62 }
  }
  private lanePos(l: number, k: number) {
    return { x: BELT_X1 - 30 - k * 62, y: LANE_Y[l] }
  }

  private updateL1(dt: number) {
    const m = this.l1
    if (this.running && !this.paused) {
      this.acc += dt
      while (this.acc >= 1 / 30) {
        this.acc -= 1 / 30
        m.step(1 / 30)
      }
      for (const e of m.events) {
        const s = this.crates.get(e.id)
        if (e.type === 'disorder') {
          chip.sfx('bad')
          this.floatText(WORKER_X + 40, s?.y ?? 200, '¡DESORDEN!', COLORS.badHex, 15)
          this.cameras.main.shake(180, 0.004)
        } else if (e.type === 'lost') {
          chip.sfx('bad')
          this.floatText(s?.x ?? 145, (s?.y ?? 260) - 30, '¡Al agua!', COLORS.badHex, 14)
        } else chip.sfx('coin')
      }
      m.events = []
      if (m.finished) {
        this.running = false
        const st = m.stars()
        if (st > 0) {
          this.l1Stars = st
          this.levelDone(st, 2, () => this.startL2(), m.errors() === 0 ? 'Cero desorden: mandaste cada mercader siempre al mismo carril. Eso es particionar por clave.' : 'Un error. Si cada mercader va siempre al mismo carril, el orden queda garantizado.')
        } else this.levelFailed(`Desorden: ${m.disorder} · Perdidas: ${m.lost}. Pista: elige un carril fijo para cada color (por ejemplo Rojo y Amarillo → carril 1…).`, () => this.startL1())
      }
    }
    // dibujo de trabajadores y progreso
    const g = this.g
    g.clear()
    LANE_Y.forEach((y, l) => {
      const q = m.laneCrates(l)
      const head = q[0]
      const dur = head ? (head.heavy ? HARBOR_L1.heavy : HARBOR_L1.light) : 1
      g.fillStyle(0x1b2547, 1).fillRect(WORKER_X - 22, y + 30, 44, 6)
      if (head) g.fillStyle(0x34d399, 1).fillRect(WORKER_X - 22, y + 30, 44 * Math.min(1, m.workerT[l] / dur), 6)
    })
    // cajas
    for (const c of m.crates) {
      let s = this.crates.get(c.id)
      if (!s && (c.state === 'done' || c.state === 'lost')) continue
      if (!s) {
        const box = this.crate(c.merchant, `#${c.seq}`, c.heavy)
        box.setPosition(60, 230).setDepth(10)
        s = { c: box, x: 60, y: 230, gone: 0 }
        this.crates.set(c.id, s)
      }
      let tx = s.x
      let ty = s.y
      if (c.state === 'intake') {
        const k = m.intake.indexOf(c.id)
        const p = this.intakePos(k)
        tx = p.x
        ty = p.y
        if (k === 0) g.lineStyle(3, 0x22d3ee, 0.5 + 0.5 * Math.sin(this.time.now / 140)).strokeRoundedRect(p.x - 30, p.y - 30, 60, 60, 8)
      } else if (c.state === 'lane') {
        const k = m.laneCrates(c.lane).findIndex((x) => x.id === c.id)
        const p = this.lanePos(c.lane, k)
        tx = p.x
        ty = p.y
      } else {
        s.gone += dt
        if (c.state === 'done') tx = 780
        else ty = s.y + 60 * dt
        s.c.setAlpha(Math.max(0, 1 - s.gone * 1.4))
        if (s.gone > 0.8) {
          s.c.destroy()
          this.crates.delete(c.id)
          continue
        }
      }
      const k = Math.min(1, dt * 10)
      s.x += (tx - s.x) * k
      s.y += (ty - s.y) * k
      s.c.setPosition(s.x, s.y)
    }
    // trabajadores (dibujados como sprites estáticos una vez)
    if (!this.objs.some((o) => o.name === 'worker')) {
      LANE_Y.forEach((y, l) => {
        const w = this.keep(this.add.image(WORKER_X, y - 4, 'chars', `${['vil2', 'vil3', 'vil4'][l]}_side0`).setScale(2.6).setFlipX(true))
        w.name = 'worker'
      })
    }
    const done = m.crates.filter((c) => c.state === 'done').length
    this.stat.setText(`Despachadas: ${done}/${HARBOR_L1.crates}   ·   Desorden: ${m.disorder}   ·   Perdidas: ${m.lost}   ·   En el muelle: ${m.intake.length}/3`)
    for (let i = 0; i < this.legend.length; i++) {
      const pending = m.crates.filter((c) => c.merchant === i && (c.state === 'intake' || c.state === 'lane')).map((c) => c.seq)
      this.legend[i].setText(`${MERCHANT_NAMES[i]}${pending.length ? ` · espera #${Math.min(...pending)}` : ''}`)
    }
  }

  /** Pool de textos reutilizables: crear textos en cada frame es caro en canvas. */
  private ptxt(x: number, y: number, s: string, size: number, color: string) {
    let t = this.stormTexts[this.poolIdx]
    if (!t) {
      t = this.txt(0, 0, '', size, color)
      this.stormTexts.push(t)
    }
    this.poolIdx++
    t.setVisible(true).setPosition(x, y).setText(s).setColor(color).setFontSize(size)
    return t
  }

  /* ============================ NIVEL 2 ============================ */
  private async startL2() {
    this.clear()
    this.level = 1
    this.lanes = 4
    this.workers = 4
    this.g = this.keep(this.add.graphics())
    this.stat = this.keep(this.txt(20, 58, '', 14, COLORS.text, { bold: true }))
    this.keep(this.panel(16, 340, 300, 150, COLORS.panel, 0.95))
    this.keep(this.txt(30, 352, `Presupuesto: ${HARBOR_L2.budget}🪙   (carril ${HARBOR_L2.laneCost}🪙 · estibador ${HARBOR_L2.workerCost}🪙)`, 12, COLORS.muted))
    const mk = (y: number, label: string, get: () => number, set: (v: number) => void, max: number) => {
      this.keep(this.txt(30, y - 9, label, 13, COLORS.text, { bold: true }))
      const val = this.keep(this.txt(264, y, String(get()), 16, COLORS.accentHex, { bold: true }).setOrigin(0.5))
      const change = (v: number) => {
        if (this.running) return
        set(v)
        val.setText(String(get()))
      }
      this.buttons.push(this.button(230, y, 30, 28, '−', () => change(Math.max(1, get() - 1)), { color: COLORS.panel2 }))
      this.buttons.push(this.button(298, y, 30, 28, '+', () => change(Math.min(max, get() + 1)), { color: COLORS.panel2 }))
    }
    mk(392, 'Carriles (particiones)', () => this.lanes, (v) => (this.lanes = v), HARBOR_L2.maxLanes)
    mk(430, 'Estibadores (consum.)', () => this.workers, (v) => (this.workers = v), HARBOR_L2.maxWorkers)
    this.cfgText = this.keep(this.txt(30, 455, '', 13, COLORS.warnHex, { bold: true }))
    this.buttons.push(this.button(560, 465, 230, 40, '▶ Que venga la tormenta', () => this.startStorm(), {}))
    this.keep(this.txt(340, 352, 'Cuando suene la campana (20 s) el agua del muelle\n(cajas pendientes = lag) debe estar por debajo de la marca.', 12, COLORS.muted))
    await this.brief({
      title: 'Nivel 2 · La tormenta',
      icon: '⛈️',
      goal: `A los 2 s llega una ola de ${HARBOR_L2.spike} cajas. Al sonar la campana (20 s), deja como mucho ${HARBOR_L2.maxLag} pendientes.`,
      how: [
        'Ahora las cajas se reparten solas: el color decide el carril (hash de la clave).',
        `Con ${HARBOR_L2.budget} monedas elige cuántos carriles y estibadores contratar.`,
        'Cada estibador despacha 1 caja por segundo y puede atender varios carriles, pero un carril solo lo atiende UN estibador.',
      ],
      concept: 'En un [[consumer-group|consumer group]] cada partición la consume un solo consumidor: el paralelismo máximo es min(particiones, consumidores). El agua que sube es el [[consumer-lag|consumer lag]].',
      button: 'Configurar',
    })
  }

  private startStorm() {
    if (this.running) return
    const cost = HarborStorm.cost(this.lanes, this.workers)
    if (cost > HARBOR_L2.budget) {
      chip.sfx('bad')
      this.floatText(560, 430, '¡Te pasas del presupuesto!', COLORS.badHex)
      return
    }
    this.storm = new HarborStorm(this.lanes, this.workers)
    this.running = true
    this.acc = 0
    chip.sfx('fire')
  }

  private updateL2(dt: number) {
    const g = this.g
    g.clear()
    const lanes = this.storm ? this.storm.lanes : this.lanes
    const workers = this.storm ? this.storm.workers : this.workers
    const cost = HarborStorm.cost(this.lanes, this.workers)
    this.cfgText?.setText(`Costo: ${cost}/${HARBOR_L2.budget}🪙   ·   paralelismo efectivo: ${Math.min(lanes, workers)}`)
    if (this.storm && this.running && !this.paused) {
      this.acc += dt
      while (this.acc >= 1 / 30) {
        this.acc -= 1 / 30
        this.storm.step(1 / 30)
      }
      if (this.storm.done) {
        this.running = false
        if (this.storm.passed())
          this.levelDone(this.l1Stars, 2, () => {}, `Quedaron ${this.storm.lag} cajas: ¡bajo la marca! ${lanes} carriles y ${workers} estibadores: cada estibador con su carril, sin ociosos ni carriles saturados.`)
        else {
          const idle = Math.max(0, workers - lanes)
          const why = idle > 0 ? `${idle} estibador(es) se quedaron ociosos: hay más consumidores que particiones.` : `Solo ${Math.min(lanes, workers)} estibadores trabajando: la capacidad (${Math.min(lanes, workers)} cajas/s) no alcanza para drenar la ola.`
          this.levelFailed(`Quedaron ${this.storm.lag} cajas pendientes (máximo ${HARBOR_L2.maxLag}). ${why}`, () => this.startL2())
        }
      }
    }
    // carriles
    const top = 96
    const h = Math.min(56, 230 / lanes)
    const queues = this.storm?.queues ?? Array(lanes).fill(0)
    this.poolIdx = 0
    const assign = (w: number) => (this.storm ? this.storm.lanesOfWorker(w) : new HarborStorm(lanes, workers).lanesOfWorker(w))
    for (let l = 0; l < lanes; l++) {
      const y = top + l * (h + 6)
      g.fillStyle(0x2a3350, 1).fillRoundedRect(150, y, 470, h, 6)
      const n = queues[l]
      const shown = Math.min(n, 18)
      for (let k = 0; k < shown; k++) {
        const m = (l + k * lanes) % HARBOR_L2.merchants
        g.fillStyle(MERCHANT_COLORS[m], 1).fillRect(600 - k * 25, y + 6, 20, h - 12)
      }
      if (n > 18) this.ptxt(156, y + h / 2, `+${n - 18}`, 12, COLORS.text).setOrigin(0, 0.5)
      this.ptxt(626, y + h / 2, `${n}`, 12, COLORS.muted).setOrigin(0, 0.5)
    }
    // estibadores
    for (let w = 0; w < workers; w++) {
      const mine = assign(w)
      const x = 680
      const y = top + w * 32
      g.fillStyle(mine.length ? 0x34d399 : 0x475569, 1).fillCircle(x, y + 10, 9)
      this.ptxt(x + 14, y + 10, mine.length ? `estibador ${w + 1} → C${mine.map((p) => p + 1).join(',C')}` : `estibador ${w + 1}: ocioso 😴`, 11, mine.length ? COLORS.text : COLORS.muted).setOrigin(0, 0.5)
    }
    // agua (lag)
    const lag = this.storm?.lag ?? 0
    const gx = 330
    const gy = 410
    const gw = 200
    g.fillStyle(0x1b2547, 1).fillRect(gx, gy, gw, 50)
    g.fillStyle(0x3a7bd5, 0.85).fillRect(gx, gy + 50 - Math.min(50, (lag / 80) * 50), gw, Math.min(50, (lag / 80) * 50))
    const markY = gy + 50 - (HARBOR_L2.maxLag / 80) * 50
    g.lineStyle(2, 0xf87171, 1).lineBetween(gx, markY, gx + gw, markY)
    this.ptxt(gx + gw + 8, gy + 10, `lag: ${lag}\nmarca: ${HARBOR_L2.maxLag}`, 12, lag > HARBOR_L2.maxLag ? COLORS.badHex : COLORS.text).setOrigin(0, 0)
    for (let i = this.poolIdx; i < this.stormTexts.length; i++) this.stormTexts[i].setVisible(false)
    const t = this.storm ? Math.max(0, HARBOR_L2.bell - this.storm.time) : HARBOR_L2.bell
    this.stat.setText(`🔔 Campana en ${t.toFixed(1)} s   ·   Llegadas: ${this.storm?.arrived ?? 0}   ·   Despachadas: ${this.storm?.processed ?? 0}`)
  }

  update(_t: number, delta: number) {
    const dt = Math.min(0.1, delta / 1000)
    if (this.level === 0 && this.l1) this.updateL1(dt)
    else if (this.level === 1 && this.g) this.updateL2(dt)
  }
}
