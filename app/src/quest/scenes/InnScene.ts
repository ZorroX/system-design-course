import * as Phaser from 'phaser'
import { BasePuzzle, COLORS, type Button } from './BasePuzzle'
import { INN_LEVELS, InnModel, INN_QUEUE_MAX, TO_INN, WALK, type InnAlgo } from '../models/inn'
import { chip } from '../audio'

const GUARD = { x: 262, y: 205 }
const SPAWN = { x: -24, y: 205 }
const LOOKS = ['vil1', 'vil2', 'vil3', 'vil4']

interface TSprite {
  c: Phaser.GameObjects.Container
  x: number
  y: number
  leaving: number
}

export class InnScene extends BasePuzzle {
  readonly puzzleId = 'inn' as const
  private model!: InnModel
  private level = 0
  private acc = 0
  private started = false
  private objs: Phaser.GameObjects.GameObject[] = []
  private buttons: Button[] = []
  private sprites = new Map<number, TSprite>()
  private innG!: Phaser.GameObjects.Graphics
  private fxG!: Phaser.GameObjects.Graphics
  private innLabels: Phaser.GameObjects.Text[] = []
  private innZones: Phaser.GameObjects.Zone[] = []
  private fireTexts = new Map<number, Phaser.GameObjects.Text>()
  private stat!: Phaser.GameObjects.Text
  private goldText?: Phaser.GameObjects.Text
  private algoBtns: Partial<Record<InnAlgo, Button>> = {}
  private buildBtn?: Button
  private watchBtn?: Button
  private startBtn?: Button
  private ended = false

  constructor() {
    super('inn')
  }

  protected build() {
    this.startLevel(0)
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o)
    return o
  }

  private clearLevel() {
    this.objs.forEach((o) => o.destroy())
    this.objs = []
    this.buttons.forEach((b) => b.destroy())
    this.buttons = []
    this.sprites.forEach((s) => s.c.destroy())
    this.sprites.clear()
    this.innLabels.forEach((t) => t.destroy())
    this.innLabels = []
    this.innZones.forEach((z) => z.destroy())
    this.innZones = []
    this.fireTexts.forEach((t) => t.destroy())
    this.fireTexts.clear()
    this.algoBtns = {}
    this.goldText = undefined
  }

  private async startLevel(i: number) {
    this.clearLevel()
    this.level = i
    this.ended = false
    this.acc = 0
    const L = INN_LEVELS[i]
    this.model = new InnModel(L, i === 0 ? 'manual' : 'rr', 7 + i)

    // camino y guardia
    const road = this.keep(this.add.graphics())
    road.fillStyle(0xc9a46a, 1).fillRect(0, GUARD.y - 22, GUARD.x + 20, 44)
    road.fillStyle(0xa98552, 1)
    for (let x = 6; x < GUARD.x; x += 22) road.fillRect(x, GUARD.y - 2, 10, 3)
    this.keep(this.add.image(GUARD.x + 4, GUARD.y + 18, 'objs', 'shadow').setScale(3))
    this.keep(this.add.image(GUARD.x + 4, GUARD.y, 'chars', 'guard_side0').setScale(3))
    this.keep(this.txt(GUARD.x + 4, GUARD.y + 42, 'Guardia\n(load balancer)', 12, COLORS.muted, { align: 'center' }).setOrigin(0.5, 0))
    this.innG = this.keep(this.add.graphics())
    this.fxG = this.keep(this.add.graphics().setDepth(50))
    this.stat = this.keep(this.txt(20, 62, '', 14, COLORS.text))

    if (i === 0) {
      this.keep(this.panel(16, 300, 420, 180, COLORS.panel, 0.9))
      this.keep(
        this.txt(32, 316, 'Toca una POSADA para enviar al primer viajero de la fila.\n\n🟥 Maleta roja = estancia larga (12 s)\n⬜ Maleta blanca = estancia corta (4 s)\n\nTruco: no mandes a todos a la misma posada; mira cuántas habitaciones quedan libres.', 14, COLORS.text, { wrap: 390 }),
      )
    } else {
      this.keep(this.panel(16, 290, 430, 196, COLORS.panel, 0.9))
      this.keep(this.txt(30, 302, 'Algoritmo del guardia', 13, COLORS.muted))
      this.algoBtns.rr = this.addBtn(this.button(110, 336, 170, 34, 'Round robin', () => this.setAlgo('rr'), { color: COLORS.panel2, size: 14 }))
      this.algoBtns.lc = this.addBtn(this.button(295, 336, 170, 34, 'Menos ocupada', () => this.setAlgo('lc'), { color: COLORS.panel2, size: 14 }))
      this.buildBtn = this.addBtn(this.button(110, 386, 170, 34, `🏨 Construir (3🪙)`, () => this.buildInn(), { color: COLORS.panel2, size: 14 }))
      this.watchBtn = this.addBtn(this.button(295, 386, 170, 34, `🔭 Vigía (2🪙)`, () => this.hireWatch(), { color: COLORS.panel2, size: 14 }))
      this.goldText = this.keep(this.txt(30, 420, '', 15, COLORS.warnHex, { bold: true }))
      this.startBtn = this.addBtn(this.button(320, 456, 220, 38, '▶ Abrir puertas', () => this.open(), {}))
      this.setAlgo('rr')
    }
    this.layoutInns()

    await this.brief(
      i === 0
        ? {
            title: 'Nivel 1 · Tú eres el balanceador',
            icon: '🏨',
            goal: 'Atiende a 20 viajeros perdiendo como mucho 2.',
            how: [
              'Los viajeros hacen fila junto al guardia. Toca una posada para enviar al primero de la fila.',
              'Cada posada tiene 2 habitaciones y una cola de 3. Si todo está lleno, el viajero se va enojado.',
              'Maleta roja = estancia larga (12 s). Maleta blanca = estancia corta (4 s).',
            ],
            concept: 'Eres un [[load-balancer|load balancer]] manual. Repartir según la carga real de cada posada es justo lo que hace el algoritmo "least connections".',
            button: '¡Abrir la posada!',
          }
        : {
            title: 'Nivel 2 · Automatiza y prepárate',
            icon: '⚙️',
            goal: 'Llegan 45 viajeros, el doble de rápido. Pierde como mucho 3.',
            how: [
              'Elige el algoritmo del guardia: Round robin (por turnos) o Menos ocupada.',
              'Con 8 monedas puedes construir posadas (3🪙) y contratar un vigía (2🪙).',
              'Rumor: a los 12 segundos una posada se incendiará durante un buen rato…',
              'Pulsa "Abrir puertas" cuando estés listo (puedes cambiar el algoritmo en marcha).',
            ],
            concept: 'Escalar horizontalmente = más posadas. El vigía es un [[health-check|health check]]: saca de la rotación a los servidores caídos para que nadie los use.',
            button: 'Configurar',
          },
    )
    this.started = i === 0
  }

  private addBtn(b: Button) {
    this.buttons.push(b)
    return b
  }

  private setAlgo(a: InnAlgo) {
    this.model.algo = a
    this.algoBtns.rr?.setSelected(a === 'rr')
    this.algoBtns.lc?.setSelected(a === 'lc')
  }
  private buildInn() {
    if (this.model.build()) {
      chip.sfx('build')
      this.layoutInns()
    }
  }
  private hireWatch() {
    if (this.model.hireWatch()) {
      chip.sfx('build')
      this.floatText(295, 386, '¡Vigía contratado!', COLORS.goodHex, 14)
    }
  }
  private open() {
    this.started = true
    this.startBtn?.setLabel('Abierto…')
    this.startBtn?.setEnabled(false)
  }

  /* ------------------------- layout de posadas ------------------------- */
  private innRect(i: number) {
    const n = this.model.inns.length
    const hh = Math.min(84, (420 - (n - 1) * 8) / n)
    return { x: 528, y: 58 + i * (hh + 8), w: 250, h: hh }
  }
  private roomPos(i: number, j: number) {
    const r = this.innRect(i)
    return { x: r.x + 138 + j * 54, y: r.y + r.h / 2 }
  }
  private queuePos(i: number, k: number) {
    const r = this.innRect(i)
    return { x: r.x - 22 - k * 26, y: r.y + r.h / 2 }
  }

  private layoutInns() {
    this.innLabels.forEach((t) => t.destroy())
    this.innZones.forEach((z) => z.destroy())
    this.innLabels = []
    this.innZones = []
    this.model.inns.forEach((_, i) => {
      const r = this.innRect(i)
      this.innLabels.push(this.txt(r.x + 14, r.y + r.h / 2, `🏨 Posada ${i + 1}`, 14, '#fff7e0', { bold: true }).setOrigin(0, 0.5))
      if (this.level === 0) {
        const z = this.add.zone(r.x - 80, r.y, r.w + 80, r.h).setOrigin(0).setInteractive({ useHandCursor: true })
        z.on('pointerdown', () => {
          if (!this.started || this.paused) return
          if (this.model.route(i)) chip.sfx('talk')
        })
        this.innZones.push(z)
      }
    })
  }

  /* ------------------------- bucle ------------------------- */
  update(_t: number, delta: number) {
    if (!this.model) return
    const dt = Math.min(0.1, delta / 1000)
    if (this.started && !this.paused && !this.ended) {
      this.acc += dt
      while (this.acc >= 1 / 30) {
        this.acc -= 1 / 30
        this.model.step(1 / 30)
      }
      this.handleEvents()
      if (this.model.finished) this.endLevel()
    }
    this.render(dt)
  }

  private handleEvents() {
    for (const e of this.model.events) {
      if (e.type === 'lost' && e.id !== undefined) {
        const s = this.sprites.get(e.id)
        if (s) this.floatText(s.x, s.y - 30, `😠 ${e.reason}`, COLORS.badHex, 12)
        chip.sfx('bad')
      } else if (e.type === 'fire' && e.inn !== undefined) {
        chip.sfx('fire')
        const r = this.innRect(e.inn)
        this.floatText(r.x + r.w / 2, r.y + 10, `🔥 ¡Incendio en la Posada ${e.inn + 1}!`, COLORS.badHex, 15)
        this.cameras.main.shake(250, 0.004)
      } else if (e.type === 'fireOut' && e.inn !== undefined) {
        const r = this.innRect(e.inn)
        this.floatText(r.x + r.w / 2, r.y + 10, 'Fuego apagado', COLORS.goodHex, 14)
      }
    }
    this.model.events = []
  }

  private endLevel() {
    this.ended = true
    const st = this.model.stars()
    const lost = this.model.lost
    if (st > 0) {
      const msg =
        this.level === 0
          ? `Perdiste ${lost} viajero(s). Mandar a cada viajero a la posada con más sitio libre es exactamente lo que hace "least connections".`
          : `Perdiste ${lost} de 45. ${this.model.watch ? 'El vigía (health check) evitó mandar gente a la posada en llamas.' : '¡Sobreviviste sin vigía! Pero con health checks habrías perdido menos.'}`
      this.levelDone(st, INN_LEVELS.length, () => this.startLevel(1), msg)
    } else {
      const hint =
        this.level === 0
          ? `Perdiste ${lost} viajeros (máximo 2). Reparte según las habitaciones libres y vigila las maletas rojas.`
          : !this.model.watch
            ? `Perdiste ${lost}. Sin vigía, el guardia siguió mandando viajeros a la posada en llamas… sobre todo con "Menos ocupada": ¡una posada vacía por el fuego parece la menos ocupada!`
            : `Perdiste ${lost}. Prueba a construir más posadas: escalar horizontalmente da más habitaciones.`
      this.levelFailed(hint, () => this.startLevel(this.level))
    }
  }

  private render(dt: number) {
    const m = this.model
    const g = this.innG
    g.clear()
    const fx = this.fxG
    fx.clear()
    // posadas
    m.inns.forEach((inn, i) => {
      const r = this.innRect(i)
      g.fillStyle(inn.fire ? 0x7f1d1d : 0x8b5e3c, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 8)
      g.fillStyle(inn.fire ? 0xb91c1c : 0xb4513b, 1).fillRoundedRect(r.x, r.y, r.w, 10, { tl: 8, tr: 8, bl: 0, br: 0 })
      g.lineStyle(2, inn.fire ? 0xf87171 : 0x5a3a20, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 8)
      for (let j = 0; j < inn.rooms.length; j++) {
        const p = this.roomPos(i, j)
        g.fillStyle(0x1b2547, 1).fillRoundedRect(p.x - 20, p.y - 20, 40, 40, 6)
        const occ = inn.rooms[j]
        g.lineStyle(2, occ !== null ? 0xfbbf24 : 0x3b4a80, 1).strokeRoundedRect(p.x - 20, p.y - 20, 40, 40, 6)
        if (occ !== null) {
          const t = m.travelers[occ]
          const frac = Math.max(0, 1 - t.t / t.stay)
          g.fillStyle(t.long ? 0xf87171 : 0x34d399, 1).fillRect(p.x - 18, p.y + 22, 36 * frac, 4)
        }
      }
      for (let k = 0; k < INN_QUEUE_MAX; k++) {
        const qp = this.queuePos(i, k)
        g.lineStyle(1.5, 0x3b4a80, 1).strokeCircle(qp.x, qp.y + 10, 10)
      }
      // fuego
      if (inn.fire && !this.fireTexts.has(i)) {
        const t = this.txt(r.x + r.w - 30, r.y + r.h / 2, '🔥', 26).setOrigin(0.5)
        this.tweens.add({ targets: t, scale: 1.25, duration: 300, yoyo: true, repeat: -1 })
        this.fireTexts.set(i, t)
      } else if (!inn.fire && this.fireTexts.has(i)) {
        this.fireTexts.get(i)!.destroy()
        this.fireTexts.delete(i)
      }
    })
    // fila del guardia
    for (let k = 0; k < 4; k++) g.lineStyle(1.5, 0x3b4a80, 0.8).strokeCircle(GUARD.x - 50 - k * 36, GUARD.y + 12, 12)

    // viajeros
    for (const t of m.travelers) {
      if (t.state === 'done' && !this.sprites.has(t.id)) continue
      let s = this.sprites.get(t.id)
      if (!s) {
        const img = this.add.image(0, 0, 'chars', `${LOOKS[t.id % 4]}_side0`).setScale(2.2)
        const bag = this.add.graphics()
        if (t.long) bag.fillStyle(0xef4444, 1).fillRect(10, -4, 11, 10).fillStyle(0x7f1d1d, 1).fillRect(13, -7, 5, 3)
        else bag.fillStyle(0xf5f5f5, 1).fillRect(11, 0, 7, 6).fillStyle(0x9ca3af, 1).fillRect(13, -2, 3, 2)
        const c = this.add.container(SPAWN.x, SPAWN.y, [img, bag]).setDepth(20)
        s = { c, x: SPAWN.x, y: SPAWN.y, leaving: 0 }
        this.sprites.set(t.id, s)
      }
      let tx = s.x
      let ty = s.y
      let scale = 1
      const img = s.c.list[0] as Phaser.GameObjects.Image
      switch (t.state) {
        case 'walking': {
          const f = Math.min(1, t.t / WALK)
          tx = SPAWN.x + (GUARD.x - 60 - 4 * 36 - SPAWN.x) * f
          ty = SPAWN.y
          img.setFlipX(false)
          break
        }
        case 'waiting': {
          const k = m.guardQueue.indexOf(t.id)
          tx = GUARD.x - 50 - k * 36
          ty = GUARD.y
          if (k === 0 && this.level === 0) fx.lineStyle(2.5, 0x22d3ee, 0.6 + 0.4 * Math.sin(this.time.now / 150)).strokeCircle(tx, ty + 4, 22)
          break
        }
        case 'toInn': {
          const r = this.innRect(t.inn)
          const f = Math.min(1, t.t / TO_INN)
          tx = GUARD.x + (r.x - 20 - GUARD.x) * f
          ty = GUARD.y + (r.y + r.h / 2 - GUARD.y) * f
          break
        }
        case 'queued': {
          const k = m.inns[t.inn].queue.indexOf(t.id)
          const qp = this.queuePos(t.inn, Math.max(0, k))
          tx = qp.x
          ty = qp.y
          scale = 0.8
          break
        }
        case 'room': {
          const p = this.roomPos(t.inn, t.room)
          tx = p.x
          ty = p.y
          scale = 0.75
          break
        }
        case 'done':
        case 'lost': {
          s.leaving += dt
          if (t.state === 'done') {
            tx = s.x + 60
            s.c.setAlpha(Math.max(0, 1 - s.leaving * 1.5))
          } else {
            ty = s.y - 40 * dt
            s.c.setAlpha(Math.max(0, 1 - s.leaving))
          }
          if (s.leaving > 1) {
            s.c.destroy()
            this.sprites.delete(t.id)
            continue
          }
          break
        }
      }
      const k = Math.min(1, dt * 12)
      s.x += (tx - s.x) * k
      s.y += (ty - s.y) * k
      s.c.setPosition(s.x, s.y)
      s.c.setScale(s.c.scale + (scale - s.c.scale) * k)
    }

    const L = this.level === 0 ? 2 : 3
    this.stat.setText(`Atendidos: ${m.served}   ·   Perdidos: ${m.lost} (máx ${L})   ·   Llegados: ${m.spawned}/${m.level.total}`)
    if (this.goldText) this.goldText.setText(`🪙 ${m.gold} monedas   ·   ${m.inns.length}/${m.level.maxInns} posadas   ·   Vigía: ${m.watch ? 'sí' : 'no'}`)
    this.buildBtn?.setEnabled(m.canBuild())
    this.watchBtn?.setEnabled(m.canHireWatch())
  }
}
