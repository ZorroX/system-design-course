import * as Phaser from 'phaser'
import { bus, setBlocking, type BriefData } from '../bus'
import { chip } from '../audio'
import { endPuzzle, returnToWorld } from './common'
import { PUZZLE_META } from '../story'
import type { PuzzleId } from '@/store/game'

export const COLORS = {
  bg: 0x0b1020,
  panel: 0x141c38,
  panel2: 0x1b2547,
  border: 0x26315a,
  text: '#e6eaf5',
  muted: '#8f9bbd',
  accent: 0x22d3ee,
  accentHex: '#22d3ee',
  good: 0x34d399,
  goodHex: '#34d399',
  warn: 0xfbbf24,
  warnHex: '#fbbf24',
  bad: 0xf87171,
  badHex: '#f87171',
  violet: 0xa78bfa,
}

export interface Button {
  container: Phaser.GameObjects.Container
  setEnabled: (b: boolean) => void
  setLabel: (s: string) => void
  setSelected: (b: boolean) => void
  destroy: () => void
}

/**
 * Base de los puzles: tablero lógico de 800x500 escalado para caber en pantalla,
 * con utilidades de texto, botones, paneles y el flujo de niveles.
 */
export abstract class BasePuzzle extends Phaser.Scene {
  abstract readonly puzzleId: PuzzleId | 'boss'
  readonly W = 800
  readonly H = 500
  protected z = 1
  protected paused = true
  protected levelStars: number[] = []
  private helpData: Omit<BriefData, 'onClose'> | null = null

  create() {
    this.levelStars = []
    this.cameras.main.setBackgroundColor(COLORS.bg)
    this.fit()
    this.scale.on('resize', this.fit, this)
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fit, this)
      this.tweens.killAll()
    })
    this.drawFrame()
    this.build()
  }

  protected abstract build(): void

  private fit() {
    const cam = this.cameras.main
    this.z = Math.min(this.scale.width / this.W, this.scale.height / this.H)
    cam.setZoom(this.z)
    cam.centerOn(this.W / 2, this.H / 2)
  }

  private drawFrame() {
    const meta = PUZZLE_META[this.puzzleId]
    const g = this.add.graphics()
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(4, 4, this.W - 8, 40, 10)
    this.txt(18, 24, `${meta.icon}  ${meta.title}`, 17, COLORS.text, { bold: true }).setOrigin(0, 0.5)
    this.button(this.W - 60, 24, 92, 30, '✕ Salir', () => this.exit(), { size: 13, color: COLORS.panel2 })
    this.button(this.W - 120, 24, 30, 30, '?', () => this.help(), { size: 15, color: COLORS.panel2 })
  }

  /* ---------------------------- UI helpers ---------------------------- */
  txt(x: number, y: number, s: string, size = 16, color = COLORS.text, opts: { bold?: boolean; wrap?: number; align?: 'left' | 'center' | 'right'; font?: 'pixel' | 'ui' | 'mono' } = {}) {
    const t = this.add.text(x, y, s, {
      fontFamily: opts.font === 'pixel' ? '"Press Start 2P", monospace' : opts.font === 'mono' ? 'ui-monospace, "Cascadia Mono", Consolas, monospace' : 'Inter, system-ui, sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle: opts.bold ? 'bold' : 'normal',
      align: opts.align ?? 'left',
      wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
      lineSpacing: 4,
    })
    t.setResolution(Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * this.z)))
    return t
  }

  panel(x: number, y: number, w: number, h: number, color = COLORS.panel, alpha = 1, stroke = COLORS.border) {
    const g = this.add.graphics()
    g.fillStyle(color, alpha).fillRoundedRect(x, y, w, h, 12)
    g.lineStyle(1.5, stroke, 1).strokeRoundedRect(x, y, w, h, 12)
    return g
  }

  button(x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts: { color?: number; textColor?: string; size?: number } = {}): Button {
    const base = opts.color ?? COLORS.accent
    const textColor = opts.textColor ?? (opts.color ? COLORS.text : '#04131a')
    const g = this.add.graphics()
    const t = this.txt(0, 0, label, opts.size ?? 15, textColor, { bold: true }).setOrigin(0.5)
    const zone = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true })
    const c = this.add.container(x, y, [g, t, zone])
    let enabled = true
    let selected = false
    let hover = false
    const draw = () => {
      g.clear()
      const fill = selected ? COLORS.accent : base
      g.fillStyle(fill, enabled ? (hover ? 0.92 : 1) : 0.35).fillRoundedRect(-w / 2, -h / 2, w, h, 10)
      g.lineStyle(1.5, selected ? 0xffffff : COLORS.border, enabled ? 1 : 0.4).strokeRoundedRect(-w / 2, -h / 2, w, h, 10)
      t.setColor(selected ? '#04131a' : textColor).setAlpha(enabled ? 1 : 0.5)
    }
    draw()
    zone.on('pointerover', () => {
      hover = true
      draw()
    })
    zone.on('pointerout', () => {
      hover = false
      draw()
    })
    zone.on('pointerdown', () => {
      if (!enabled) return
      chip.sfx('talk')
      this.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true })
      onClick()
    })
    return {
      container: c,
      setEnabled: (b) => {
        enabled = b
        draw()
      },
      setLabel: (s) => t.setText(s),
      setSelected: (b) => {
        selected = b
        draw()
      },
      destroy: () => c.destroy(),
    }
  }

  /** Texto flotante que sube y desaparece (feedback). */
  floatText(x: number, y: number, s: string, color = COLORS.text, size = 16) {
    const t = this.txt(x, y, s, size, color, { bold: true }).setOrigin(0.5).setDepth(5000)
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => t.destroy() })
  }

  stars(n: number) {
    return '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n))
  }

  /* ---------------------------- flujo ---------------------------- */
  /** Muestra el briefing en React y resuelve al cerrarlo. */
  brief(data: Omit<BriefData, 'onClose'>): Promise<void> {
    this.helpData = data
    this.paused = true
    setBlocking(true)
    return new Promise((resolve) => {
      bus.emit('brief', {
        ...data,
        onClose: () => {
          setBlocking(false)
          this.paused = false
          resolve()
        },
      })
    })
  }

  private help() {
    if (!this.helpData) return
    const wasPaused = this.paused
    this.paused = true
    setBlocking(true)
    bus.emit('brief', {
      ...this.helpData,
      button: 'Seguir jugando',
      onClose: () => {
        setBlocking(false)
        this.paused = wasPaused
      },
    })
  }

  /** Panel modal dentro del canvas (fin de nivel, fallo). */
  overlay(title: string, body: string, buttons: { label: string; onClick: () => void; primary?: boolean }[], color = COLORS.accentHex) {
    const items: Phaser.GameObjects.GameObject[] = []
    const shade = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.55).setInteractive().setDepth(8000)
    items.push(shade)
    const p = this.panel(this.W / 2 - 220, this.H / 2 - 120, 440, 240, COLORS.panel, 0.98, 0x3b4a80).setDepth(8001)
    items.push(p)
    items.push(this.txt(this.W / 2, this.H / 2 - 88, title, 24, color, { bold: true, align: 'center' }).setOrigin(0.5).setDepth(8002))
    items.push(this.txt(this.W / 2, this.H / 2 - 20, body, 15, COLORS.text, { align: 'center', wrap: 390 }).setOrigin(0.5).setDepth(8002))
    const bw = Math.min(190, 400 / buttons.length - 10)
    const others: Button[] = []
    buttons.forEach((b, i) => {
      const x = this.W / 2 + (i - (buttons.length - 1) / 2) * (bw + 12)
      const btn = this.button(
        x,
        this.H / 2 + 75,
        bw,
        40,
        b.label,
        () => {
          items.forEach((it) => it.destroy())
          others.forEach((o) => o.destroy())
          b.onClick()
        },
        b.primary ? {} : { color: COLORS.panel2 },
      )
      btn.container.setDepth(8003)
      others.push(btn)
    })
    this.tweens.add({ targets: p, alpha: { from: 0, to: 1 }, duration: 200 })
  }

  /** Nivel superado: guarda estrellas y avanza o termina. */
  levelDone(stars: number, total: number, next: () => void, extra = '') {
    this.levelStars.push(stars)
    chip.sfx('ok')
    const last = this.levelStars.length >= total
    this.overlay(
      `¡Nivel superado! ${this.stars(stars)}`,
      extra || (last ? 'Has completado la prueba.' : 'Prepárate para el siguiente nivel.'),
      [{ label: last ? 'Terminar' : 'Siguiente nivel →', primary: true, onClick: () => (last ? this.finish() : next()) }],
      COLORS.goodHex,
    )
  }

  levelFailed(reason: string, retry: () => void) {
    chip.sfx('lose')
    this.overlay('Casi…', reason, [
      { label: 'Reintentar', primary: true, onClick: retry },
      { label: 'Salir', onClick: () => this.exit() },
    ], COLORS.warnHex)
  }

  finish(stars?: number) {
    const s = stars ?? Math.max(1, Math.round(this.levelStars.reduce((a, b) => a + b, 0) / Math.max(1, this.levelStars.length)))
    this.paused = true
    endPuzzle(this, this.puzzleId, s)
  }

  exit() {
    this.paused = true
    setBlocking(false)
    returnToWorld(this)
  }
}
