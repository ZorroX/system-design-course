import type * as Phaser from 'phaser'
import { COLORS } from './BasePuzzle'
import { TreasuryBase } from './TreasuryBase'
import { chip } from '../audio'
import { VAULT_ACTIONS, VAULT_L1, VAULT_L2, correctAction, explain, payloadHash, statusOf, vaultL2Stars, vaultStars, type LedgerEntry, type VaultAction } from '../models/vault'

export class VaultScene extends TreasuryBase {
  readonly puzzleId = 'vault' as const
  private idx = 0
  private ledger: LedgerEntry[] = []
  private errors = 0
  private charges = 0
  private doubles = 0
  private lost = 0
  private correct = 0
  private ledgerText?: Phaser.GameObjects.Text
  private statsText?: Phaser.GameObjects.Text

  constructor() {
    super('vault')
  }

  protected build() {
    this.startL1()
  }

  /* ============================ NIVEL 1 ============================ */
  private async startL1() {
    this.clearLevel()
    this.idx = 0
    this.ledger = []
    this.errors = this.charges = this.doubles = this.lost = 0
    this.keep(this.panel(16, 56, 370, 430))
    this.keep(this.txt(32, 70, '🗄️ Tabla idempotency_keys', 15, COLORS.accentHex, { bold: true }))
    this.keep(this.txt(32, 96, 'clave     hash   monto   estado', 13, COLORS.muted, { font: 'mono' }))
    this.ledgerText = this.keep(this.txt(32, 120, '', 14, COLORS.text, { font: 'mono' }))
    this.statsText = this.keep(this.txt(32, 400, '', 14, COLORS.text, { wrap: 340 }))
    this.keep(this.add.image(330, 80, 'chars', 'idem_down0').setScale(2.4))
    this.refreshLedger()
    await this.brief({
      title: 'Nivel 1 · La ventanilla idempotente',
      icon: '🏦',
      goal: 'Atiende 12 peticiones de pago con como mucho 3 errores. Ningún cliente debe pagar dos veces.',
      how: [
        'Cada petición trae un header Idempotency-Key y un cuerpo (monto + destino). Mostramos el hash del cuerpo.',
        'Compara con la tabla: ¿la clave es nueva? ¿El hash coincide? ¿El primer cobro ya terminó o sigue EN CURSO?',
        'Un cobro sigue en curso durante las 2 peticiones siguientes (el adquirente tarda).',
      ],
      concept: 'Una [[idempotency|idempotency key]] identifica una operación lógica, no una petición HTTP. El hash del payload detecta que alguien reutilizó la clave para OTRA operación.',
      button: 'Abrir la ventanilla',
    })
    this.showRequest()
  }

  private refreshLedger() {
    const rows = this.ledger.map((e) => {
      const st = statusOf(e, this.idx) === 'progress' ? '⏳ EN_CURSO' : '✅ OK'
      return `${e.key.padEnd(9)} ${e.hash}   $${String(e.amount).padEnd(5)} ${st}`
    })
    this.ledgerText?.setText(rows.length ? rows.join('\n') : '(vacía)')
    this.statsText?.setText(`💳 Cobros: ${this.charges}    ⚠️ Dobles cargos: ${this.doubles}\n😞 Pagos perdidos: ${this.lost}    ❌ Errores: ${this.errors}/3`)
  }

  private showRequest() {
    this.clearCard()
    if (this.idx >= VAULT_L1.length) return this.endL1()
    this.refreshLedger()
    const r = VAULT_L1[this.idx]
    const x = 400
    this.tmp(this.panel(x, 56, 384, 430))
    this.tmp(this.txt(x + 16, 68, `Petición ${this.idx + 1}/${VAULT_L1.length} · ${r.who}`, 14, COLORS.muted))
    this.tmp(this.txt(x + 16, 92, `POST /v1/charges\nIdempotency-Key: ${r.key}\n{ "monto": ${r.amount}, "destino": "${r.dest}" }\nhash(cuerpo) = ${payloadHash(r)}`, 14, '#fff7e0', { font: 'mono', wrap: 356 }))
    this.tmp(this.txt(x + 16, 180, r.note, 13, COLORS.muted, { wrap: 356 }))
    const answer = (a: VaultAction) => {
      const right = correctAction(this.ledger, r, this.idx)
      const ok = a === right
      chip.sfx(ok ? 'coin' : 'bad')
      if (!ok) {
        this.errors++
        if (a === 'process') this.doubles++
        else if (right === 'process') this.lost++
      }
      if (right === 'process') {
        this.charges++
        this.ledger.push({ key: r.key, hash: payloadHash(r), amount: r.amount, at: this.idx })
      }
      btns.forEach((b, i) => b.setState(VAULT_ACTIONS[i].id === right ? 'right' : VAULT_ACTIONS[i].id === a ? 'wrong' : 'off'))
      this.refreshLedger()
      this.tmp(this.txt(x + 16, 384, `${ok ? '✅' : '❌'} ${explain(right, r)}`, 13, ok ? COLORS.goodHex : COLORS.text, { wrap: 356 }))
      this.cardButton(x + 300, 466, 150, 32, this.idx + 1 < VAULT_L1.length ? 'Siguiente →' : 'Resultado', () => {
        this.idx++
        this.showRequest()
      }, { size: 13 })
    }
    const btns = VAULT_ACTIONS.map((a, i) => this.option(x + 16 + (i % 2) * 182, 222 + Math.floor(i / 2) * 76, 174, a.label, () => answer(a.id), 13))
  }

  private endL1() {
    this.clearCard()
    const s = vaultStars(this.errors)
    if (!s)
      return this.levelFailed(`${this.errors} errores (${this.doubles} dobles cargos, ${this.lost} pagos perdidos). Regla: clave nueva → cobrar; misma clave y mismo hash → respuesta guardada (o 409 si sigue en curso); misma clave y otro hash → 422.`, () => this.startL1())
    this.levelDone(s, 2, () => this.startL2(), `${this.errors} error(es), ${this.doubles} dobles cargos. Ahora, lo difícil: ¿qué pasa cuando el banco no contesta?`)
  }

  /* ============================ NIVEL 2 ============================ */
  private async startL2() {
    this.clearLevel()
    this.idx = 0
    this.correct = 0
    const g = this.keep(this.add.graphics())
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(16, 56, 300, 430, 12)
    g.fillStyle(0x1e3a5f, 1).fillRoundedRect(40, 120, 100, 60, 10)
    g.fillStyle(0x3f2d0a, 1).fillRoundedRect(190, 120, 100, 60, 10)
    g.lineStyle(3, 0x22d3ee, 1).lineBetween(140, 150, 190, 150)
    this.keep(this.txt(90, 150, 'Tu API', 14, COLORS.text, { bold: true }).setOrigin(0.5))
    this.keep(this.txt(240, 150, 'Adquirente', 14, COLORS.text, { bold: true }).setOrigin(0.5))
    const cut = this.keep(this.txt(165, 128, '✂️', 20, '#fff').setOrigin(0.5))
    this.tweens.add({ targets: cut, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 })
    this.keep(this.txt(36, 210, 'Estados de un pago:\nCREADO → EN_CURSO → CAPTURADO\n                 ↘ FALLIDO\n                 ↘ DESCONOCIDO → (consulta / conciliación)', 12, COLORS.muted, { font: 'mono' }))
    this.statsText = this.keep(this.txt(36, 440, '', 14, COLORS.text))
    await this.brief({
      title: 'Nivel 2 · El último milisegundo',
      icon: '✂️',
      goal: `Toma al menos ${VAULT_L2.length - 2} de ${VAULT_L2.length} decisiones correctas.`,
      how: [
        'La red se corta en el peor momento: el banco pudo cobrar o no.',
        'Elige la opción que protege el saldo del cliente y el dinero del comercio, con la solución más simple que funcione (KISS).',
      ],
      concept: 'Un timeout NO significa "falló": significa "no sé". La consistencia financiera sale de [[idempotency|idempotencia]], estados explícitos, [[outbox|outbox]] y conciliación.',
      button: 'Enfrentar la tormenta',
    })
    this.showCase()
  }

  private showCase() {
    this.clearCard()
    this.statsText?.setText(`Aciertos: ${this.correct}/${this.idx}`)
    if (this.idx >= VAULT_L2.length) return this.endL2()
    const c = VAULT_L2[this.idx]
    const x = 330
    this.tmp(this.panel(x, 56, 454, 430))
    this.tmp(this.txt(x + 16, 68, `Caso ${this.idx + 1}/${VAULT_L2.length} · ${c.title}`, 15, COLORS.accentHex, { bold: true }))
    const q = this.tmp(this.txt(x + 16, 94, c.text, 14, '#fff7e0', { wrap: 420 }))
    const { all, bottom } = this.optionList(x + 16, 104 + q.height, 422, c.options, (i, opts) => {
      const ok = i === c.answer
      if (ok) this.correct++
      chip.sfx(ok ? 'ok' : 'bad')
      opts.forEach((o, k) => o.setState(k === c.answer ? 'right' : k === i ? 'wrong' : 'off'))
      this.tmp(this.txt(x + 16, bottom + 4, c.why, 13, COLORS.text, { wrap: 420 }))
      this.statsText?.setText(`Aciertos: ${this.correct}/${this.idx + 1}`)
      this.cardButton(x + 370, 466, 150, 32, this.idx + 1 < VAULT_L2.length ? 'Siguiente →' : 'Resultado', () => {
        this.idx++
        this.showCase()
      }, { size: 13 })
    })
    void all
  }

  private endL2() {
    const s = vaultL2Stars(this.correct)
    if (!s) return this.levelFailed(`${this.correct}/${VAULT_L2.length}. Recuerda: ante la duda, estado PENDIENTE + consultar con la misma referencia; UNIQUE en la base; una transacción local + outbox.`, () => this.startL2())
    this.levelDone(s, 2, () => {}, `${this.correct}/${VAULT_L2.length} decisiones correctas. El saldo de Nimbus está a salvo.`)
  }
}
