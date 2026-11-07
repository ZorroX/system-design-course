import type * as Phaser from 'phaser'
import { BasePuzzle, COLORS, type Button } from './BasePuzzle'

export interface OptionButton {
  height: number
  setState: (s: 'idle' | 'right' | 'wrong' | 'off') => void
  destroy: () => void
}

/**
 * Base de las pruebas del Distrito del Tesoro: capas de objetos (nivel y tarjeta)
 * y botones de opción con texto multilínea.
 */
export abstract class TreasuryBase extends BasePuzzle {
  private lvlObjs: Phaser.GameObjects.GameObject[] = []
  private lvlBtns: { destroy: () => void }[] = []
  private cardObjs: Phaser.GameObjects.GameObject[] = []
  private cardBtns: { destroy: () => void }[] = []

  /** objeto que vive todo el nivel */
  protected keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.lvlObjs.push(o)
    return o
  }
  /** objeto que vive hasta la próxima tarjeta */
  protected tmp<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.cardObjs.push(o)
    return o
  }
  protected lvlButton(...args: Parameters<BasePuzzle['button']>): Button {
    const b = this.button(...args)
    this.lvlBtns.push(b)
    return b
  }
  protected cardButton(...args: Parameters<BasePuzzle['button']>): Button {
    const b = this.button(...args)
    this.cardBtns.push(b)
    return b
  }
  protected clearCard() {
    this.cardObjs.forEach((o) => o.destroy())
    this.cardBtns.forEach((b) => b.destroy())
    this.cardObjs = []
    this.cardBtns = []
  }
  protected clearLevel() {
    this.clearCard()
    this.lvlObjs.forEach((o) => o.destroy())
    this.lvlBtns.forEach((b) => b.destroy())
    this.lvlObjs = []
    this.lvlBtns = []
  }

  /** Botón ancho con texto que se ajusta en varias líneas. Vive en la capa de tarjeta. */
  protected option(x: number, y: number, w: number, label: string, onClick: () => void, size = 13): OptionButton {
    const t = this.txt(x + 12, y + 8, label, size, COLORS.text, { wrap: w - 24 })
    const h = Math.max(34, t.height + 16)
    const g = this.add.graphics()
    let state: 'idle' | 'right' | 'wrong' | 'off' = 'idle'
    let hover = false
    const draw = () => {
      g.clear()
      const fill = state === 'right' ? 0x14532d : state === 'wrong' ? 0x7f1d1d : hover ? 0x26315a : COLORS.panel2
      const stroke = state === 'right' ? COLORS.good : state === 'wrong' ? COLORS.bad : hover ? COLORS.accent : COLORS.border
      g.fillStyle(fill, state === 'off' ? 0.5 : 1).fillRoundedRect(x, y, w, h, 10)
      g.lineStyle(1.5, stroke, 1).strokeRoundedRect(x, y, w, h, 10)
      t.setAlpha(state === 'off' ? 0.55 : 1)
    }
    draw()
    const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true })
    zone.on('pointerover', () => {
      hover = true
      draw()
    })
    zone.on('pointerout', () => {
      hover = false
      draw()
    })
    zone.on('pointerdown', () => {
      if (state !== 'idle') return
      onClick()
    })
    g.setDepth(10)
    t.setDepth(11)
    this.cardObjs.push(g, t, zone)
    return {
      height: h,
      setState: (s) => {
        state = s
        if (s !== 'idle') zone.disableInteractive()
        draw()
      },
      destroy: () => {
        g.destroy()
        t.destroy()
        zone.destroy()
      },
    }
  }

  /** Lista vertical de opciones; devuelve la altura total usada. */
  protected optionList(x: number, y: number, w: number, labels: string[], onPick: (i: number, all: OptionButton[]) => void, size = 13, gap = 8): { all: OptionButton[]; bottom: number } {
    const all: OptionButton[] = []
    let cy = y
    labels.forEach((l, i) => {
      const o = this.option(x, cy, w, l, () => onPick(i, all), size)
      all.push(o)
      cy += o.height + gap
    })
    return { all, bottom: cy }
  }

  /** Texto con **negrita** simplificado: quita los asteriscos (el canvas no mezcla estilos). */
  protected plain(s: string) {
    return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  }
}
