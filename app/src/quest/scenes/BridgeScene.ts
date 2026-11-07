import * as Phaser from 'phaser'
import { BasePuzzle, COLORS, type Button } from './BasePuzzle'
import { CAP_CARDS, QUORUM_N, capStars, evaluateQuorum } from '../models/bridge'
import { makeRng } from '../models/rng'
import { chip } from '../audio'

export class BridgeScene extends BasePuzzle {
  readonly puzzleId = 'bridge' as const
  private objs: Phaser.GameObjects.GameObject[] = []
  private buttons: Button[] = []
  private card = 0
  private correct = 0
  private capResult = 0
  private visitor?: Phaser.GameObjects.Image
  private r = 2
  private w = 2
  private scribes: { img: Phaser.GameObjects.Image; ledger: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Arc }[] = []
  private testing = false
  private qUI: { wv: Phaser.GameObjects.Text; rv: Phaser.GameObjects.Text; formula: Phaser.GameObjects.Text } | null = null

  constructor() {
    super('bridge')
  }

  protected build() {
    this.startCap()
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
    this.scribes = []
    this.visitor = undefined
    this.qUI = null
  }

  /* ============================ PARTE A: CAP ============================ */
  private async startCap() {
    this.clear()
    this.card = 0
    this.correct = 0
    // ilustración
    const g = this.keep(this.add.graphics())
    g.fillStyle(0x1f4d2e, 1).fillRoundedRect(16, 56, 360, 430, 12)
    g.fillStyle(0x3a7bd5, 1).fillRect(16, 250, 360, 44)
    g.fillStyle(0x62a0ee, 1)
    for (let x = 30; x < 370; x += 40) g.fillRect(x, 262, 16, 3)
    g.fillStyle(0xa4733f, 1).fillRect(170, 236, 18, 20).fillRect(200, 288, 18, 18)
    this.keep(this.txt(196, 72, 'NORTE · 2 de 3 escribas (mayoría)', 13, COLORS.goodHex, { bold: true }).setOrigin(0.5, 0))
    this.keep(this.txt(196, 466, 'SUR · 1 de 3 escribas (minoría)', 13, COLORS.warnHex, { bold: true }).setOrigin(0.5, 1))
    this.keep(this.txt(196, 272, '✂️ puente roto', 13, '#ffffff', { bold: true }).setOrigin(0.5))
    for (const [x, y] of [[90, 150], [150, 150], [130, 380]] as [number, number][]) {
      this.keep(this.add.image(x, y, 'chars', 'sage_down0').setScale(2.6))
      this.keep(this.add.image(x + 22, y + 8, 'objs', 'book').setScale(1.4))
    }
    for (const [x, y] of [[300, 120], [330, 175], [300, 400]] as [number, number][]) {
      g.fillStyle(0xe7d6ae, 1).fillRect(x - 18, y - 6, 36, 26)
      g.fillStyle(0xb4513b, 1).fillTriangle(x - 24, y - 4, x + 24, y - 4, x, y - 26)
      g.fillStyle(0x5aa5e6, 1).fillRect(x - 12, y + 2, 8, 8)
      g.fillStyle(0x7a4e2c, 1).fillRect(x + 4, y + 4, 8, 16)
    }
    this.keep(this.txt(196, 210, 'Libro de cuentas', 11, COLORS.muted).setOrigin(0.5))
    await this.brief({
      title: 'Parte 1 · El pueblo partido',
      icon: '🌉',
      goal: 'Acierta al menos 5 de 6 decisiones.',
      how: [
        'El puente cayó: el Norte (2 escribas) y el Sur (1 escriba) no pueden sincronizar su libro de cuentas.',
        'Llegan vecinos con peticiones. Decide: ¿atender ya (disponibilidad) o rechazar hasta que vuelva el puente (consistencia)?',
        'Pista: ¿quién tiene la mayoría? ¿Qué pasa si el otro lado hace lo contrario al mismo tiempo?',
      ],
      concept: 'Durante una [[network-partition|partición de red]], el [[cap|teorema CAP]] te obliga a elegir. Lo maduro es elegir POR OPERACIÓN.',
      button: 'Atender al pueblo',
    })
    this.showCard()
  }

  private cardObjs: Phaser.GameObjects.GameObject[] = []
  private cardBtns: Button[] = []
  private clearCard() {
    this.cardObjs.forEach((o) => o.destroy())
    this.cardBtns.forEach((b) => b.destroy())
    this.cardObjs = []
    this.cardBtns = []
  }

  private showCard() {
    this.clearCard()
    if (this.card >= CAP_CARDS.length) return this.endCap()
    const c = CAP_CARDS[this.card]
    const north = c.side === 'norte'
    this.visitor?.destroy()
    this.visitor = this.keep(this.add.image(north ? 250 : 260, north ? 190 : 360, 'chars', `${['vil1', 'vil2', 'vil3', 'vil4'][this.card % 4]}_down0`).setScale(2.8))
    this.tweens.add({ targets: this.visitor, y: this.visitor.y - 8, duration: 220, yoyo: true, repeat: 1 })
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.cardObjs.push(o)
      return o
    }
    add(this.panel(392, 56, 392, 430, COLORS.panel, 0.97))
    add(this.txt(410, 72, `Petición ${this.card + 1}/${CAP_CARDS.length}   ·   aciertos: ${this.correct}`, 13, COLORS.muted))
    add(this.txt(410, 100, north ? 'NORTE · tiene mayoría (2/3)' : 'SUR · minoría (1/3)', 14, north ? COLORS.goodHex : COLORS.warnHex, { bold: true }))
    add(this.txt(410, 130, c.who, 18, COLORS.text, { bold: true }))
    add(this.txt(410, 162, `“${c.ask}”`, 20, '#fff7e0', { wrap: 356 }))
    const answer = (choice: 'atender' | 'rechazar') => {
      const ok = choice === c.correct
      if (ok) this.correct++
      chip.sfx(ok ? 'ok' : 'bad')
      this.cardBtns.forEach((b) => b.setEnabled(false))
      add(this.txt(410, 326, ok ? '✅ ¡Bien decidido!' : `❌ Mejor: ${c.correct === 'atender' ? 'atender' : 'rechazar'}`, 16, ok ? COLORS.goodHex : COLORS.badHex, { bold: true }))
      add(this.txt(410, 352, c.why, 13, COLORS.text, { wrap: 356 }))
      this.cardBtns.push(
        this.button(690, 462, 150, 34, this.card + 1 < CAP_CARDS.length ? 'Siguiente →' : 'Ver resultado', () => {
          this.card++
          this.showCard()
        }, { size: 14 }),
      )
    }
    this.cardBtns.push(this.button(500, 280, 200, 44, '✅ Atender ahora', () => answer('atender'), { color: 0x14532d, size: 14 }))
    this.cardBtns.push(this.button(700, 280, 160, 44, '⏳ Rechazar', () => answer('rechazar'), { color: 0x713f12, size: 14 }))
  }

  private endCap() {
    const s = capStars(this.correct)
    if (s === 0) return this.levelFailed(`Acertaste ${this.correct} de 6. Regla práctica: dinero e inventario escaso necesitan mayoría (consistencia); datos de consulta pueden servirse algo viejos (disponibilidad).`, () => this.startCap())
    this.capResult = s
    this.levelDone(s, 2, () => this.startQuorum(), `${this.correct}/6. El Norte tiene quórum y puede seguir escribiendo; el Sur solo debe responder lo que no hace daño si está desactualizado.`)
  }

  /* ============================ PARTE B: QUÓRUM ============================ */
  private async startQuorum() {
    this.clear()
    this.clearCard()
    this.r = 2
    this.w = 2
    this.keep(this.txt(this.W / 2, 64, `La Cerradura del Quórum · N = ${QUORUM_N} escribas`, 18, COLORS.accentHex, { bold: true }).setOrigin(0.5, 0))
    for (let i = 0; i < QUORUM_N; i++) {
      const x = 160 + i * 120
      const ring = this.keep(this.add.circle(x, 170, 40, 0x22d3ee, 0).setStrokeStyle(4, 0x22d3ee, 0))
      const img = this.keep(this.add.image(x, 166, 'chars', 'sage_down0').setScale(3))
      const ledger = this.keep(this.txt(x, 222, 'v1', 15, COLORS.text, { bold: true }).setOrigin(0.5))
      this.scribes.push({ img, ledger, ring })
    }
    const formula = this.keep(this.txt(this.W / 2, 262, '', 17, COLORS.text, { bold: true }).setOrigin(0.5))
    const mk = (x: number, label: string, get: () => number, set: (v: number) => void) => {
      this.keep(this.txt(x, 300, label, 14, COLORS.muted).setOrigin(0.5))
      const val = this.keep(this.txt(x, 340, '', 28, COLORS.text, { bold: true }).setOrigin(0.5))
      this.buttons.push(this.button(x - 64, 340, 40, 36, '−', () => !this.testing && set(Math.max(1, get() - 1)), { color: COLORS.panel2 }))
      this.buttons.push(this.button(x + 64, 340, 40, 36, '+', () => !this.testing && set(Math.min(QUORUM_N, get() + 1)), { color: COLORS.panel2 }))
      return val
    }
    const wv = mk(250, 'W · escribas que confirman cada escritura', () => this.w, (v) => (this.w = v))
    const rv = mk(550, 'R · escribas consultados en cada lectura', () => this.r, (v) => (this.r = v))
    const result = this.keep(this.txt(this.W / 2, 404, '', 14, COLORS.text, { wrap: 700, align: 'center' }).setOrigin(0.5, 0))
    this.buttons.push(this.button(this.W / 2, 466, 200, 40, '🔐 Probar la cerradura', () => this.testQuorum(result), {}))
    this.qUI = { wv, rv, formula }
    await this.brief({
      title: 'Parte 2 · La Cerradura del Quórum',
      icon: '🔐',
      goal: 'Elige W y R para que (1) nunca se lea un dato viejo, (2) se aguante a un escriba enfermo y (3) se consulte lo mínimo.',
      how: [
        'Cada escritura se confirma en W escribas al azar; cada lectura consulta R escribas al azar.',
        'Si ninguno de los R consultados recibió la última escritura… ¡dato viejo!',
        'Si algún escriba enferma, ¿todavía puedes reunir W o R escribas?',
      ],
      concept: 'Es el [[quorum|quórum]] de Dynamo y Cassandra. Piensa en cuándo los dos grupos (los W y los R) se solapan seguro.',
      button: 'Abrir la cerradura',
    })
  }

  private testQuorum(result: Phaser.GameObjects.Text) {
    if (this.testing) return
    this.testing = true
    const rnd = makeRng(Date.now() % 100000)
    const pick = (n: number) => [...Array(QUORUM_N).keys()].sort(() => rnd() - 0.5).slice(0, n)
    let trial = 0
    let staleSeen = 0
    const runTrial = () => {
      if (trial >= 5) return finalize()
      const wrote = pick(this.w)
      const read = pick(this.r)
      this.scribes.forEach((s, i) => {
        s.ledger.setText(wrote.includes(i) ? `v${trial + 2}` : `v${trial + 1}`).setColor(wrote.includes(i) ? COLORS.goodHex : COLORS.muted)
        s.ring.setStrokeStyle(4, 0x22d3ee, 0)
      })
      this.time.delayedCall(420, () => {
        read.forEach((i) => this.scribes[i].ring.setStrokeStyle(4, 0x60a5fa, 1))
        const fresh = read.some((i) => wrote.includes(i))
        if (!fresh) staleSeen++
        this.floatText(this.W / 2, 140, fresh ? `Lectura ${trial + 1}: ✓ dato actual` : `Lectura ${trial + 1}: ✗ ¡dato viejo!`, fresh ? COLORS.goodHex : COLORS.badHex, 16)
        chip.sfx(fresh ? 'coin' : 'bad')
        trial++
        this.time.delayedCall(650, runTrial)
      })
    }
    const finalize = () => {
      // prueba de enfermedad
      const sick = this.scribes[QUORUM_N - 1]
      sick.img.setTint(0x666666)
      sick.ledger.setText('🤒').setColor(COLORS.text)
      const ev = evaluateQuorum(this.r, this.w, makeRng(5))
      this.time.delayedCall(700, () => {
        sick.img.clearTint()
        this.testing = false
        result.setText(staleSeen ? `Viste ${staleSeen} lectura(s) vieja(s) en la prueba. ${ev.msg}` : ev.msg).setColor(ev.ok ? COLORS.goodHex : COLORS.warnHex)
        if (ev.ok) {
          chip.sfx('ok')
          this.time.delayedCall(900, () => this.levelDone(Math.min(this.capResult, ev.stars), 2, () => {}, ev.msg))
        } else chip.sfx('bad')
      })
    }
    result.setText('Probando…').setColor(COLORS.muted)
    runTrial()
  }

  update() {
    if (!this.qUI) return
    const { wv, rv, formula } = this.qUI
    wv.setText(String(this.w))
    rv.setText(String(this.r))
    const sum = this.r + this.w
    formula.setText(`R + W = ${sum} ${sum > QUORUM_N ? '>' : '≤'} N = ${QUORUM_N}`).setColor(sum > QUORUM_N ? COLORS.goodHex : COLORS.badHex)
  }
}
