import type * as Phaser from 'phaser'
import { COLORS } from './BasePuzzle'
import { TreasuryBase } from './TreasuryBase'
import { chip } from '../audio'
import {
  BAKE_TIMES,
  BASE_ERR,
  BASE_P99,
  Canary,
  ERR_THRESHOLDS,
  L1_HARM_BUDGET,
  L1_RELEASES,
  L2_TIME_BUDGET,
  LAT_THRESHOLDS,
  STEPS,
  l1Stars,
  runAutoAll,
  type AutoPolicy,
} from '../models/aviary'

const TICK_MS = 260

export class AviaryScene extends TreasuryBase {
  readonly puzzleId = 'aviary' as const
  private relIdx = 0
  private canary: Canary | null = null
  private harm = 0
  private acc = 0
  private gfx?: Phaser.GameObjects.Graphics
  private head?: Phaser.GameObjects.Text
  private stat?: Phaser.GameObjects.Text
  private log?: Phaser.GameObjects.Text
  private stepTexts: Phaser.GameObjects.Text[] = []
  private between = false
  private policy: AutoPolicy = { errThr: 0.25, latThr: 25, bake: 5 }

  constructor() {
    super('aviary')
  }

  protected build() {
    this.startManual()
  }

  /* ============================ NIVEL 1: manual ============================ */
  private async startManual() {
    this.clearLevel()
    this.relIdx = 0
    this.harm = 0
    this.canary = null
    this.head = this.keep(this.txt(24, 60, '', 15, COLORS.text, { bold: true }))
    this.stepTexts = STEPS.map((s, i) => this.keep(this.txt(40 + i * 92, 100, `${s}%`, 15, COLORS.muted, { bold: true }).setOrigin(0.5)))
    this.keep(this.panel(16, 126, 560, 360))
    this.keep(this.txt(30, 134, 'Tasa de error (%)  ·  🟡 canary   ⚪ estable', 12, COLORS.muted))
    this.keep(this.txt(30, 306, 'Latencia p99 (ms)  ·  🟡 canary   ⚪ estable', 12, COLORS.muted))
    this.gfx = this.keep(this.add.graphics())
    this.keep(this.panel(586, 126, 198, 360))
    this.keep(this.add.image(686, 160, 'chars', 'canaria_down0').setScale(2.6))
    this.stat = this.keep(this.txt(598, 190, '', 12, COLORS.text, { wrap: 176 }))
    this.log = this.keep(this.txt(598, 318, '', 11, COLORS.muted, { wrap: 176 }))
    this.lvlButton(685, 420, 176, 36, '⏩ Subir tráfico', () => this.doAdvance(), { size: 14 })
    this.lvlButton(685, 462, 176, 36, '⏪ Rollback', () => this.doRollback(), { size: 14, color: 0x7f1d1d })
    await this.brief({
      title: 'Nivel 1 · Suelta al canario',
      icon: '🐤',
      goal: `Despliega 3 versiones del servicio de pagos. Promueve las sanas al 100%, haz rollback de las defectuosas y daña a menos de ${L1_HARM_BUDGET} peticiones en total.`,
      how: [
        'Cada versión empieza con el 1% del tráfico. Tú decides cuándo subir: 1% → 5% → 25% → 50% → 100%.',
        'Compara la línea del canary con la de la versión estable. Con poco tráfico la línea es ruidosa: espera un poco antes de decidir.',
        'Cuanto más tráfico tenga una versión mala, más usuarios sufren.',
      ],
      concept: 'Un despliegue canary expone la versión nueva a una fracción pequeña del tráfico y la compara con la estable (error rate, p99). Si empeora, rollback automático o manual antes de afectar a todos.',
      button: 'Abrir la jaula',
    })
    this.startRelease()
  }

  private startRelease() {
    const rel = L1_RELEASES[this.relIdx]
    this.canary = new Canary(rel, 40 + this.relIdx * 9)
    for (let i = 0; i < 5; i++) this.canary.tick()
    this.between = false
    this.acc = 0
    this.head?.setText(`Versión ${this.relIdx + 1}/${L1_RELEASES.length}: ${rel.version} · "${rel.note}"`)
    this.log?.setText('Mira las curvas unos segundos antes de subir el tráfico.')
  }

  private doAdvance() {
    const c = this.canary
    if (!c || this.between || c.status !== 'running') return
    chip.sfx('talk')
    c.advance()
    if ((c.status as Canary['status']) === 'promoted') this.finishRelease()
  }

  private doRollback() {
    const c = this.canary
    if (!c || this.between || c.status !== 'running') return
    chip.sfx('door')
    c.rollback()
    this.finishRelease()
  }

  private finishRelease() {
    const c = this.canary!
    this.between = true
    const rel = c.rel
    const promoted = c.status === 'promoted'
    if (promoted && !rel.good) {
      // la versión mala queda al 100% hasta que alguien lo note
      for (let i = 0; i < 30; i++) c.tick()
    }
    this.harm += c.harm
    const ok = rel.good === promoted
    chip.sfx(ok ? 'ok' : 'bad')
    const msg = ok
      ? promoted
        ? `✅ ${rel.version} promovida: sus métricas eran iguales a las de la estable.`
        : `✅ Rollback a tiempo: ${rel.version} ${rel.errDelta ? `tenía +${rel.errDelta} pts de error` : `subía el p99 +${rel.latDelta} ms`}.`
      : promoted
        ? `❌ ${rel.version} era defectuosa y llegó al 100% del tráfico.`
        : `❌ ${rel.version} estaba sana: el rollback frenó una entrega válida.`
    this.log?.setText(msg)
    this.time.delayedCall(1800, () => {
      if (!ok) return this.levelFailed(`${msg} Compara canary contra estable y espera a tener suficientes datos en cada paso.`, () => this.startManual())
      this.relIdx++
      if (this.relIdx < L1_RELEASES.length) return this.startRelease()
      this.canary = null
      const h = Math.round(this.harm)
      if (h > L1_HARM_BUDGET) return this.levelFailed(`Decidiste bien, pero ${h} peticiones fallaron (presupuesto ${L1_HARM_BUDGET}). Haz rollback en cuanto la diferencia sea clara, sin subir más el tráfico.`, () => this.startManual())
      this.levelDone(l1Stars(h), 2, () => this.startAuto(), `Peticiones dañadas: ${h}. Ahora automatiza estas decisiones.`)
    })
  }

  private drawCharts() {
    const g = this.gfx
    const c = this.canary
    if (!g || !c) return
    g.clear()
    const pts = c.history.slice(-80)
    const plot = (y0: number, h: number, maxV: number, pick: (p: (typeof pts)[number]) => number, color: number) => {
      g.lineStyle(2, color, 1)
      let started = false
      g.beginPath()
      pts.forEach((p, i) => {
        const v = pick(p)
        if (Number.isNaN(v)) return
        const x = 34 + (i / 79) * 530
        const y = y0 + h - Math.min(1, v / maxV) * h
        if (!started) {
          g.moveTo(x, y)
          started = true
        } else g.lineTo(x, y)
      })
      g.strokePath()
    }
    g.fillStyle(0x0b1020, 1).fillRect(30, 152, 540, 140).fillRect(30, 324, 540, 150)
    plot(152, 140, 8, (p) => p.sErr, 0xcbd5e1)
    plot(152, 140, 8, (p) => p.cErr, 0xfacc15)
    plot(324, 150, 700, (p) => p.sP99, 0xcbd5e1)
    plot(324, 150, 700, (p) => p.cP99, 0xfacc15)
    // líneas de referencia
    g.lineStyle(1, 0x334155, 1).lineBetween(30, 152 + 140 - (BASE_ERR / 8) * 140, 570, 152 + 140 - (BASE_ERR / 8) * 140)
    g.lineBetween(30, 324 + 150 - (BASE_P99 / 700) * 150, 570, 324 + 150 - (BASE_P99 / 700) * 150)
    this.stepTexts.forEach((t, i) => t.setColor(c.status === 'running' && i === c.step ? COLORS.warnHex : i < c.step || c.status === 'promoted' ? COLORS.goodHex : COLORS.muted))
    const w = c.window(10)
    this.stat?.setText(
      `Canary: ${c.share}% · paso: ${c.time - c.stepStart} s\nÚltimos 10 s (canary / estable):\nerror ${w.cErr.toFixed(2)}% / ${w.sErr.toFixed(2)}%\np99 ${Math.round(w.cP99)} / ${Math.round(w.sP99)} ms\nDañadas: ${Math.round(this.harm + c.harm)} / ${L1_HARM_BUDGET}`,
    )
  }

  update(_t: number, delta: number) {
    if (this.paused || !this.canary) return
    if (this.canary.status === 'running' && !this.between) {
      this.acc += delta
      while (this.acc >= TICK_MS) {
        this.acc -= TICK_MS
        this.canary.tick()
      }
    }
    this.drawCharts()
  }

  /* ============================ NIVEL 2: análisis automático ============================ */
  private async startAuto() {
    this.clearLevel()
    this.canary = null
    this.policy = { errThr: 0.25, latThr: 25, bake: 5 }
    this.keep(this.panel(16, 56, 300, 430))
    this.keep(this.txt(30, 66, '🤖 Análisis automático del canary', 14, COLORS.accentHex, { bold: true }))
    this.keep(this.txt(30, 92, 'En cada paso, el pipeline observa el canary durante el tiempo de observación y lo compara con la estable. Si supera un umbral → rollback automático.', 12, COLORS.muted, { wrap: 272 }))
    const vals: Record<string, Phaser.GameObjects.Text> = {}
    const row = (y: number, key: keyof AutoPolicy, label: string, list: number[], fmt: (v: number) => string) => {
      this.keep(this.txt(30, y, label, 13, COLORS.text, { bold: true }))
      vals[key] = this.keep(this.txt(230, y + 30, fmt(this.policy[key]), 15, COLORS.accentHex, { bold: true }).setOrigin(0.5))
      const set = (d: number) => {
        const i = Math.max(0, Math.min(list.length - 1, list.indexOf(this.policy[key]) + d))
        this.policy[key] = list[i]
        vals[key].setText(fmt(list[i]))
      }
      this.lvlButton(170, y + 30, 30, 26, '−', () => set(-1), { color: COLORS.panel2 })
      this.lvlButton(290, y + 30, 30, 26, '+', () => set(1), { color: COLORS.panel2 })
    }
    row(176, 'errThr', 'Umbral de error (pts sobre la estable)', ERR_THRESHOLDS, (v) => `+${v}`)
    row(250, 'latThr', 'Umbral de p99 (ms sobre la estable)', LAT_THRESHOLDS, (v) => `+${v} ms`)
    row(324, 'bake', 'Tiempo de observación por paso', BAKE_TIMES, (v) => `${v} s`)
    this.lvlButton(166, 462, 260, 38, '🚀 Ejecutar 6 despliegues', () => this.runAuto())
    this.keep(this.panel(326, 56, 458, 430))
    this.log = this.keep(this.txt(340, 68, 'Resultados aparecerán aquí.', 12, COLORS.text, { font: 'mono', wrap: 432 }))
    await this.brief({
      title: 'Nivel 2 · El canario automático',
      icon: '🤖',
      goal: `Configura el análisis para que ninguna versión defectuosa llegue al 100%, no haya rollbacks de versiones sanas y el total tarde ≤ ${L2_TIME_BUDGET} s.`,
      how: [
        'Umbrales muy estrictos → el ruido normal dispara rollbacks falsos. Muy permisivos → se escapan fallos.',
        'Poco tiempo de observación → pocas muestras, mucho ruido. Demasiado → entregas lentas.',
        'Vienen 6 versiones: algunas sanas (una algo más lenta pero aceptable) y otras con fallos de error o latencia.',
      ],
      concept: 'Herramientas como Argo Rollouts, Flagger o AWS CodeDeploy automatizan el canary: pasos de tráfico, análisis de métricas y rollback sin intervención manual ("diseña asumiendo el fracaso").',
      button: 'Configurar',
    })
  }

  private runAuto() {
    chip.sfx('build')
    const s = runAutoAll({ ...this.policy })
    const lines = s.outcomes.map((o) => {
      const icon = o.verdict === 'ok' ? '✅' : o.verdict === 'escaped' ? '💀' : '⚠️'
      return `${icon} ${o.version} ${o.good ? '(sana)' : '(defectuosa)'} → ${o.result === 'promoted' ? 'PROMOVIDA' : 'ROLLBACK'} · ${o.seconds}s\n   ${o.reason}`
    })
    let shown = 0
    const reveal = () => {
      shown++
      this.log?.setText(lines.slice(0, shown).join('\n'))
      chip.sfx(s.outcomes[shown - 1].verdict === 'ok' ? 'coin' : 'bad')
      if (shown < lines.length) this.time.delayedCall(450, reveal)
      else {
        this.log?.setText(`${lines.join('\n')}\n\nTiempo total: ${s.seconds} s · dañadas: ${s.harm}\n${s.msg}`)
        this.time.delayedCall(1200, () => {
          if (!s.stars) return this.levelFailed(s.msg, () => this.startAuto())
          this.levelDone(s.stars, 2, () => {}, s.msg)
        })
      }
    }
    reveal()
  }
}
