import type * as Phaser from 'phaser'
import { COLORS } from './BasePuzzle'
import { TreasuryBase } from './TreasuryBase'
import { chip } from '../audio'
import {
  COMP_OPTIONS,
  FORWARD_OPTIONS,
  FORWARD_WHY,
  SAGA_ROUNDS,
  SAGA_STEPS,
  TCC_ACTIONS,
  TCC_MSGS,
  TCC_START_BALANCE,
  sagaStars,
  tccApply,
  tccCorrect,
  tccStars,
  tccWhy,
  type TccAction,
  type Wallet,
} from '../models/caravan'

const TOWN_X = [150, 310, 470, 630]
const ROAD_Y = 150

export class CaravanScene extends TreasuryBase {
  readonly puzzleId = 'caravan' as const
  private round = 0
  private errors = 0
  private marks: Phaser.GameObjects.Text[] = []
  private caravan?: Phaser.GameObjects.Image
  private info?: Phaser.GameObjects.Text
  private wallet: Wallet = { available: TCC_START_BALANCE, frozen: 0, txs: {} }
  private idx = 0
  private walletText?: Phaser.GameObjects.Text

  constructor() {
    super('caravan')
  }

  protected build() {
    this.startSaga()
  }

  /* ============================ NIVEL 1: SAGA ============================ */
  private async startSaga() {
    this.clearLevel()
    this.round = 0
    this.errors = 0
    const g = this.keep(this.add.graphics())
    g.fillStyle(0x3b2f1e, 1).fillRoundedRect(16, 56, 768, 180, 12)
    g.fillStyle(0xc9a46a, 1).fillRect(40, ROAD_Y + 18, 720, 10)
    this.keep(this.txt(52, 70, '🎼 Orquestador', 13, COLORS.text, { bold: true }))
    this.marks = []
    SAGA_STEPS.forEach((s, i) => {
      const x = TOWN_X[i]
      g.fillStyle(0x1b2547, 1).fillCircle(x, ROAD_Y, 26)
      g.lineStyle(2, 0x3b4a80, 1).strokeCircle(x, ROAD_Y, 26)
      this.keep(this.txt(x, ROAD_Y, s.icon, 22, '#fff').setOrigin(0.5))
      this.keep(this.txt(x, ROAD_Y + 40, `${i + 1}. ${s.town}`, 12, COLORS.text, { bold: true }).setOrigin(0.5))
      this.keep(this.txt(x, ROAD_Y + 58, s.action, 11, COLORS.muted, { align: 'center', wrap: 140 }).setOrigin(0.5, 0))
      this.marks.push(this.keep(this.txt(x + 22, ROAD_Y - 26, '', 18, '#fff').setOrigin(0.5)))
    })
    this.keep(this.txt(720, ROAD_Y - 40, 'Pivote:\ndesde el cobro,\nsolo hacia adelante', 10, COLORS.warnHex, { align: 'center' }).setOrigin(0.5))
    this.caravan = this.keep(this.add.image(60, ROAD_Y + 6, 'chars', 'tece_side0').setScale(2.4))
    this.keep(this.panel(16, 246, 768, 240))
    this.info = this.keep(this.txt(32, 256, '', 14, COLORS.text, { wrap: 736 }))
    await this.brief({
      title: 'Nivel 1 · La saga del pago',
      icon: '🐪',
      goal: 'Tres caravanas sufrirán un fallo en distintos pueblos. Recupera cada una de forma consistente con como mucho 2 errores.',
      how: [
        'Un pago recorre 4 servicios, cada uno con su propia base de datos: no hay transacción global.',
        'Si un paso falla, el orquestador ejecuta las COMPENSACIONES de los pasos ya hechos, en orden inverso.',
        'Ojo: un paso que solo leyó datos no necesita compensación, y compensar no es borrar filas (es una acción de negocio).',
        'Después del pivote (el cobro), un fallo transitorio se resuelve reintentando hacia adelante.',
      ],
      concept: 'Una [[saga|saga]] reemplaza la transacción distribuida ([[two-pc|2PC]]) por pasos locales + compensaciones. La [[orchestration|orquestación]] centraliza la lógica en un coordinador.',
      button: 'Partir',
    })
    this.playRound()
  }

  private moveTo(x: number, flip = false): Promise<void> {
    return new Promise((res) => {
      this.caravan?.setFlipX(flip)
      this.tweens.add({ targets: this.caravan, x, duration: 450, ease: 'Sine.inOut', onComplete: () => res() })
    })
  }

  private async playRound() {
    this.clearCard()
    if (this.round >= SAGA_ROUNDS.length) return this.endSaga()
    const r = SAGA_ROUNDS[this.round]
    this.marks.forEach((m) => m.setText(''))
    this.caravan?.setPosition(60, ROAD_Y + 6)
    this.info?.setText(`Caravana ${this.round + 1}/${SAGA_ROUNDS.length} en camino…`)
    for (let i = 0; i <= r.failAt; i++) {
      await this.moveTo(TOWN_X[i] - 34)
      if (i < r.failAt) {
        this.marks[i].setText('✅')
        chip.sfx('coin')
      } else {
        this.marks[i].setText('💥')
        chip.sfx('bad')
        this.cameras.main.shake(150, 0.004)
      }
    }
    this.info?.setText(`💥 ${r.failText}`)
    if (r.forward) this.askForward()
    else this.askComp(r.failAt - 1)
  }

  private askForward() {
    this.clearCard()
    this.tmp(this.txt(32, 290, '¿Qué hace el orquestador?', 15, COLORS.accentHex, { bold: true }))
    const { bottom } = this.optionList(32, 318, 736, FORWARD_OPTIONS.map((o) => o.label), async (i, all) => {
      const ok = FORWARD_OPTIONS[i].correct
      if (!ok) this.errors++
      chip.sfx(ok ? 'ok' : 'bad')
      all.forEach((o, k) => o.setState(FORWARD_OPTIONS[k].correct ? 'right' : k === i ? 'wrong' : 'off'))
      this.tmp(this.txt(32, bottom, this.plain(FORWARD_WHY), 12, COLORS.text, { wrap: 736 }))
      this.marks[SAGA_ROUNDS[this.round].failAt].setText('🔁')
      this.time.delayedCall(700, () => this.marks[SAGA_ROUNDS[this.round].failAt].setText('✅'))
      this.cardButton(700, 466, 150, 30, 'Siguiente →', () => {
        this.round++
        this.playRound()
      }, { size: 13 })
    }, 13, 6)
  }

  private askComp(step: number) {
    this.clearCard()
    if (step < 0) {
      this.info?.setText('↩️ Saga compensada: todo quedó consistente (pago cancelado, nada cobrado ni retenido).')
      this.cardButton(700, 466, 150, 30, 'Siguiente →', () => {
        this.round++
        this.playRound()
      }, { size: 13 })
      return
    }
    const s = SAGA_STEPS[step]
    void this.moveTo(TOWN_X[step] + 34, true)
    this.tmp(this.txt(32, 290, `Compensar el paso ${step + 1} · ${s.town} («${s.action}»):`, 15, COLORS.accentHex, { bold: true }))
    const labels = COMP_OPTIONS
    const btns = labels.map((l, i) =>
      this.option(32 + (i % 3) * 248, 320 + Math.floor(i / 3) * 52, 240, l, () => {
        const ok = l === s.comp
        if (!ok) this.errors++
        chip.sfx(ok ? 'ok' : 'bad')
        btns.forEach((b, k) => b.setState(labels[k] === s.comp ? 'right' : k === i ? 'wrong' : 'off'))
        this.marks[step].setText('↩️')
        const why = ok
          ? 'Correcto.'
          : l === 'Borrar la fila de la base de datos'
            ? 'Compensar no es borrar: es una acción de negocio visible (liberar, reembolsar) que deja rastro auditable.'
            : `La compensación de «${s.action}» es: ${s.comp}.`
        this.tmp(this.txt(32, 430, why, 13, ok ? COLORS.goodHex : COLORS.text, { wrap: 600 }))
        this.cardButton(700, 466, 150, 30, 'Continuar →', () => this.askComp(step - 1), { size: 13 })
      }, 12),
    )
  }

  private endSaga() {
    const s = sagaStars(this.errors)
    if (!s) return this.levelFailed(`${this.errors} errores. Compensa en orden inverso solo lo que se hizo; lo que solo leyó no se compensa; tras el pivote, reintenta hacia adelante.`, () => this.startSaga())
    this.levelDone(s, 2, () => this.startTcc(), `${this.errors} error(es). Ahora verás TCC: reservar primero, confirmar o cancelar después.`)
  }

  /* ============================ NIVEL 2: TCC ============================ */
  private async startTcc() {
    this.clearLevel()
    this.idx = 0
    this.errors = 0
    this.wallet = { available: TCC_START_BALANCE, frozen: 0, txs: {} }
    this.keep(this.panel(16, 56, 300, 430))
    this.keep(this.add.image(270, 86, 'chars', 'tece_down0').setScale(2.2))
    this.keep(this.txt(32, 70, '👛 Servicio Billetera\n(participante TCC)', 14, COLORS.accentHex, { bold: true }))
    this.walletText = this.keep(this.txt(32, 130, '', 14, COLORS.text, { font: 'mono' }))
    this.refreshWallet()
    await this.brief({
      title: 'Nivel 2 · Try-Confirm-Cancel',
      icon: '🧊',
      goal: 'Responde a 9 mensajes del coordinador con como mucho 2 errores.',
      how: [
        'Try: reservar (congelar) fondos. Confirm: descontar lo congelado. Cancel: liberarlo.',
        'La red desordena y duplica mensajes. Confirm y Cancel deben ser idempotentes.',
        'Cancel sin Try previo → "cancelación vacía" (regístrala). Try que llega después de su Cancel → rechazar (anti-suspensión).',
      ],
      concept: 'TCC reserva recursos en la fase Try y los confirma o libera después; lo usan los sistemas financieros de gran escala (p. ej. el modo TCC de Seata). Es más estricto que una [[saga|saga]]: nunca se gasta dinero que luego haya que devolver.',
      button: 'Abrir la billetera',
    })
    this.showMsg()
  }

  private refreshWallet() {
    const w = this.wallet
    const txs = Object.entries(w.txs).map(([k, v]) => `  ${k}: ${v === 'tried' ? 'CONGELADA' : v === 'confirmed' ? 'CONFIRMADA' : v === 'cancelled' ? 'CANCELADA' : 'CANCEL. VACÍA'}`)
    this.walletText?.setText(`Disponible: $${w.available}\nCongelado:  $${w.frozen}\n\nTransacciones:\n${txs.join('\n') || '  (ninguna)'}\n\n❌ Errores: ${this.errors}/2`)
  }

  private showMsg() {
    this.clearCard()
    this.refreshWallet()
    if (this.idx >= TCC_MSGS.length) return this.endTcc()
    const m = TCC_MSGS[this.idx]
    const x = 330
    this.tmp(this.panel(x, 56, 454, 430))
    this.tmp(this.txt(x + 16, 68, `Mensaje ${this.idx + 1}/${TCC_MSGS.length} del coordinador`, 13, COLORS.muted))
    this.tmp(this.txt(x + 16, 92, `${m.op.toUpperCase()}  ${m.tx}  $${m.amount}`, 24, m.op === 'try' ? '#93c5fd' : m.op === 'confirm' ? '#86efac' : '#fca5a5', { bold: true, font: 'mono' }))
    const note = m.note ? this.tmp(this.txt(x + 16, 128, m.note, 12, COLORS.muted, { wrap: 420 })) : null
    const right = tccCorrect(this.wallet, m)
    const why = tccWhy(this.wallet, m)
    const { all, bottom } = this.optionList(x + 16, note ? 136 + note.height : 140, 420, TCC_ACTIONS.map((a) => a.label), (i, opts) => {
      const a: TccAction = TCC_ACTIONS[i].id
      const ok = a === right
      if (!ok) this.errors++
      chip.sfx(ok ? 'coin' : 'bad')
      opts.forEach((o, k) => o.setState(TCC_ACTIONS[k].id === right ? 'right' : k === i ? 'wrong' : 'off'))
      this.wallet = tccApply(this.wallet, m)
      this.refreshWallet()
      this.tmp(this.txt(x + 16, bottom, this.plain(why), 13, ok ? COLORS.goodHex : COLORS.text, { wrap: 420 }))
      this.cardButton(x + 370, 466, 150, 30, this.idx + 1 < TCC_MSGS.length ? 'Siguiente →' : 'Resultado', () => {
        this.idx++
        this.showMsg()
      }, { size: 13 })
    }, 13, 5)
    void all
  }

  private endTcc() {
    const s = tccStars(this.errors)
    if (!s) return this.levelFailed(`${this.errors} errores. Claves de TCC: Confirm/Cancel idempotentes, cancelación vacía registrada y Try tardío rechazado.`, () => this.startTcc())
    this.levelDone(s, 2, () => {}, `${this.errors} error(es). Saldo final: $${this.wallet.available} disponibles, $${this.wallet.frozen} congelados. Ni un centavo perdido.`)
  }
}
