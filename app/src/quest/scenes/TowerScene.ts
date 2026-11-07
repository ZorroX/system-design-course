import type * as Phaser from 'phaser'
import { COLORS } from './BasePuzzle'
import { TreasuryBase } from './TreasuryBase'
import { chip } from '../audio'
import { INCIDENTS, towerStars, type Choice } from '../models/tower'

export class TowerScene extends TreasuryBase {
  readonly puzzleId = 'tower' as const
  private lvl = 0
  private used = new Set<string>()
  private count = 0
  private restarted = false
  private wrong = 0
  private term?: Phaser.GameObjects.Text
  private counter?: Phaser.GameObjects.Text
  private cmdBtns: { id: string; setState: (s: 'idle' | 'right' | 'wrong' | 'off') => void }[] = []

  constructor() {
    super('tower')
  }

  protected build() {
    this.startIncident(0)
  }

  private async startIncident(n: number) {
    this.clearLevel()
    this.lvl = n
    this.used = new Set()
    this.count = 0
    this.restarted = false
    this.wrong = 0
    const inc = INCIDENTS[n]
    // alerta
    const alertBg = this.keep(this.add.rectangle(400, 66, 768, 26, 0x7f1d1d, 1).setOrigin(0.5, 0.5))
    this.tweens.add({ targets: alertBg, alpha: 0.6, duration: 600, yoyo: true, repeat: -1 })
    this.keep(this.txt(400, 66, inc.alert, 12, '#fff', { bold: true }).setOrigin(0.5))
    // paleta de comandos
    this.keep(this.panel(16, 84, 300, 402))
    this.keep(this.txt(28, 92, `${inc.icon} Incidente ${n + 1}/${INCIDENTS.length}: ${inc.title}`, 13, COLORS.accentHex, { bold: true }))
    this.counter = this.keep(this.txt(28, 112, '', 12, COLORS.muted))
    // terminal
    this.keep(this.panel(326, 84, 458, 402, 0x05070f, 1, 0x1f2a4a))
    this.term = this.keep(this.txt(338, 94, '', 11, '#a7f3d0', { font: 'mono', wrap: 436 }))
    this.term.setWordWrapWidth(436, false) // ajuste básico: conserva la sangría de las salidas
    this.term.setText('app@pay-api-3:~$ _\n\n(Elige comandos a la izquierda. Cuando tengas evidencia suficiente, pulsa "Diagnosticar".)')
    this.lvlButton(166, 466, 270, 32, '🩺 Diagnosticar', () => this.ask(inc.diagnosis, () => this.ask(inc.fix, () => this.solved())), { size: 14 })
    this.drawCommands()
    this.refreshCounter()
    await this.brief({
      title: `Incidente ${n + 1} · ${inc.title}`,
      icon: inc.icon,
      goal: 'Encuentra la causa raíz con pocos comandos, sin reiniciar antes de capturar evidencia, y elige el arreglo correcto.',
      how: [
        'Cada comando muestra lo que verías en un servidor Linux real con la JVM.',
        'Algunos comandos necesitan datos de otro (p. ej., el id del hilo).',
        `3★ con ${inc.optimal + 1} comandos o menos. Reiniciar borra la evidencia: como mucho 1★.`,
      ],
      concept: 'En la entrevista quieren comandos y flujos concretos, no "reviso los logs". Primero mitiga sin perder evidencia; luego causa raíz y [[post-mortem|post-mortem]].',
      button: 'Conectarme por SSH',
    })
  }

  private refreshCounter() {
    this.counter?.setText(`Comandos usados: ${this.count}${this.restarted ? '  ·  ⚠ reiniciaste' : ''}`)
  }

  private drawCommands() {
    this.clearCard()
    const inc = INCIDENTS[this.lvl]
    this.cmdBtns = []
    let y = 132
    for (const c of inc.commands) {
      const locked = (c.requires ?? []).some((r) => !this.used.has(r))
      const label = `${this.used.has(c.id) ? '✓ ' : ''}$ ${c.cmd}`
      const o = this.option(26, y, 280, label, () => this.exec(c.id), 11)
      if (locked) o.setState('off')
      this.cmdBtns.push({ id: c.id, setState: o.setState })
      y += o.height + 5
      if (y > 440) break
    }
  }

  private exec(id: string) {
    const inc = INCIDENTS[this.lvl]
    const c = inc.commands.find((x) => x.id === id)!
    if (!this.used.has(id)) this.count++
    this.used.add(id)
    if (c.restart && !this.restarted) {
      this.restarted = true
      this.cameras.main.shake(200, 0.006)
      chip.sfx('bad')
    } else chip.sfx('talk')
    this.term?.setText(`app@pay-api-3:~$ ${c.cmd}\n${c.out}`)
    this.refreshCounter()
    this.drawCommands()
  }

  private ask(ch: Choice, next: () => void) {
    this.clearCard()
    this.tmp(this.add.rectangle(400, 270, 800, 460, 0x000000, 0.55).setInteractive().setDepth(5))
    this.tmp(this.panel(90, 80, 620, 400, COLORS.panel, 0.98, 0x3b4a80).setDepth(6))
    this.tmp(this.txt(110, 96, ch.q, 17, COLORS.accentHex, { bold: true }).setDepth(7))
    const { bottom } = this.optionList(110, 130, 580, ch.options, (i, all) => {
      const ok = i === ch.answer
      if (!ok) this.wrong++
      chip.sfx(ok ? 'ok' : 'bad')
      all.forEach((o, k) => o.setState(k === ch.answer ? 'right' : k === i ? 'wrong' : 'off'))
      this.tmp(this.txt(110, bottom + 2, ch.explain, 13, COLORS.text, { wrap: 580 }).setDepth(7))
      if (ok) this.cardButton(620, 456, 150, 32, 'Continuar →', next, { size: 13 }).container.setDepth(8)
      else {
        this.cardButton(540, 456, 150, 32, 'Investigar más', () => this.drawCommands(), { size: 13, color: COLORS.panel2 }).container.setDepth(8)
        this.cardButton(400 - 50, 456, 150, 32, 'Reintentar', () => this.ask(ch, next), { size: 13 }).container.setDepth(8)
      }
    })
  }

  private solved() {
    this.clearCard()
    const inc = INCIDENTS[this.lvl]
    const s = Math.max(1, towerStars(this.count, inc.optimal, this.restarted) - this.wrong)
    const extra = `${this.count} comandos${this.restarted ? ' y reiniciaste antes de capturar evidencia (máx. 1★)' : ''}${this.wrong ? `, ${this.wrong} respuesta(s) equivocada(s)` : ''}. ${inc.lesson}`
    this.levelDone(s, INCIDENTS.length, () => this.startIncident(this.lvl + 1), extra)
  }
}
