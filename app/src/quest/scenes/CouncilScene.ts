import type * as Phaser from 'phaser'
import { COLORS } from './BasePuzzle'
import { TreasuryBase } from './TreasuryBase'
import { chip } from '../audio'
import { COUNCIL_HEARTS, COUNCIL_QS, STAR_LABEL, STAR_STORIES, councilStars, starStars, type StarPart } from '../models/council'
import { makeRng } from '../models/rng'

const ORDER: StarPart[] = ['S', 'T', 'A', 'R']

export class CouncilScene extends TreasuryBase {
  readonly puzzleId = 'council' as const
  private story = 0
  private filled = 0
  private errors = 0
  private slots: Phaser.GameObjects.Text[] = []
  private idx = 0
  private wrong = 0
  private hearts?: Phaser.GameObjects.Text

  constructor() {
    super('council')
  }

  protected build() {
    this.startStar()
  }

  /* ============================ NIVEL 1: STAR ============================ */
  private async startStar() {
    this.clearLevel()
    this.story = 0
    this.errors = 0
    await this.brief({
      title: 'Nivel 1 · Historias STAR',
      icon: '⭐',
      goal: 'Ordena 3 historias con el método STAR y descarta la frase que sobra. Como mucho 4 errores.',
      how: [
        'Situación: el contexto en una frase. Tarea: tu responsabilidad. Acción: lo que TÚ hiciste. Resultado: el impacto, con números.',
        'Toca los fragmentos en orden S → T → A → R.',
        'Cada historia trae una frase trampa (culpar a otros, moda, reescritura total). No la elijas.',
      ],
      concept: 'El panel ejecutivo valora respuestas estructuradas y breves. STAR evita la verborrea y obliga a cerrar con un resultado medible.',
      button: 'Entrar al Consejo',
    })
    this.showStory()
  }

  private showStory() {
    this.clearCard()
    if (this.story >= STAR_STORIES.length) return this.endStar()
    const st = STAR_STORIES[this.story]
    this.filled = 0
    this.tmp(this.panel(16, 56, 768, 64))
    this.tmp(this.add.image(46, 88, 'chars', 'estrella_down0').setScale(2.2))
    this.tmp(this.txt(76, 66, `Historia ${this.story + 1}/${STAR_STORIES.length} · errores: ${this.errors}`, 12, COLORS.muted))
    this.tmp(this.txt(76, 86, st.prompt, 14, '#fff7e0', { bold: true, wrap: 560 }))
    // ranuras
    this.slots = ORDER.map((p, i) => {
      this.tmp(this.panel(16, 128 + i * 76, 330, 70, COLORS.panel, 1))
      this.tmp(this.txt(28, 134 + i * 76, `${p} · ${STAR_LABEL[p]}`, 12, COLORS.accentHex, { bold: true }))
      return this.tmp(this.txt(28, 151 + i * 76, '…', 11, COLORS.muted, { wrap: 306 }))
    })
    // fragmentos barajados
    const rnd = makeRng(31 + this.story)
    const frags = [...ORDER.map((p) => ({ part: p as StarPart | 'X', text: st.parts[p] })), { part: 'X' as const, text: st.noise }].sort(() => rnd() - 0.5)
    const msg = this.tmp(this.txt(20, 436, '', 12, COLORS.text, { wrap: 326 }))
    let y = 128
    frags.forEach((f) => {
      const o = this.option(360, y, 424, f.text, () => {
        const want = ORDER[this.filled]
        if (f.part === want) {
          chip.sfx('ok')
          o.setState('right')
          this.slots[this.filled].setText(f.text).setColor(COLORS.text)
          this.filled++
          msg.setText('')
          if (this.filled === 4) {
            msg.setText(`✅ Historia completa. Descartaste: "${st.noise}" → ${st.noiseWhy}`)
            this.cardButton(712, 100, 130, 28, 'Siguiente →', () => {
              this.story++
              this.showStory()
            }, { size: 13 })
          }
        } else {
          this.errors++
          chip.sfx('bad')
          this.cameras.main.shake(120, 0.003)
          msg.setText(f.part === 'X' ? `❌ Esa frase sobra: ${st.noiseWhy}` : `❌ Ahora toca ${STAR_LABEL[want]}. Ese fragmento es ${STAR_LABEL[f.part]}.`)
        }
      }, 11)
      y += o.height + 5
    })
  }

  private endStar() {
    this.clearCard()
    const s = starStars(this.errors)
    if (!s) return this.levelFailed(`${this.errors} errores. Situación (contexto) → Tarea (tu responsabilidad) → Acción (lo que hiciste) → Resultado (impacto medible).`, () => this.startStar())
    this.levelDone(s, 2, () => this.startCouncil(), `${this.errors} error(es). Ahora, el Consejo pregunta en persona.`)
  }

  /* ============================ NIVEL 2: el Consejo ============================ */
  private async startCouncil() {
    this.clearLevel()
    this.idx = 0
    this.wrong = 0
    const judges: [string, string, number][] = [
      ['paxi', 'Reina del Negocio', 200],
      ['ada', 'Archimago Técnico', 400],
      ['sage', 'Tesorero', 600],
    ]
    for (const [look, name, x] of judges) {
      this.keep(this.add.image(x, 92, 'chars', `${look}_down0`).setScale(2.6))
      this.keep(this.txt(x, 122, name, 12, COLORS.muted).setOrigin(0.5))
    }
    this.hearts = this.keep(this.txt(760, 66, '', 18, '#fff').setOrigin(1, 0))
    this.refreshHearts()
    await this.brief({
      title: 'Nivel 2 · Ante el Consejo',
      icon: '👑',
      goal: `Responde 7 preguntas del Consejo perdiendo menos de ${COUNCIL_HEARTS} corazones de confianza.`,
      how: [
        'Elige la respuesta más ejecutiva: concisa, honesta y conectada con el negocio y el usuario.',
        'Algunas preguntas llegan en inglés técnico, como en la entrevista real.',
        'Reconocer lo que no sabes (y cómo lo aprenderías) suma; divagar resta.',
      ],
      concept: 'Toma de decisiones con costo-beneficio, deuda técnica gestionada, post-mortems sin culpables y colaboración global asíncrona.',
      button: 'Hablar',
    })
    this.showQ()
  }

  private refreshHearts() {
    this.hearts?.setText('❤️'.repeat(Math.max(0, COUNCIL_HEARTS - this.wrong)) + '🖤'.repeat(Math.min(COUNCIL_HEARTS, this.wrong)))
  }

  private showQ() {
    this.clearCard()
    if (this.idx >= COUNCIL_QS.length) return this.endCouncil()
    const q = COUNCIL_QS[this.idx]
    this.tmp(this.panel(16, 140, 768, 346))
    this.tmp(this.txt(32, 150, `${q.who} · pregunta ${this.idx + 1}/${COUNCIL_QS.length}`, 12, COLORS.muted))
    const t = this.tmp(this.txt(32, 170, q.q, 16, '#fff7e0', { bold: true, wrap: 736 }))
    const { bottom } = this.optionList(32, 182 + t.height, 736, q.options, (i, all) => {
      const ok = i === q.answer
      if (!ok) this.wrong++
      chip.sfx(ok ? 'ok' : 'bad')
      this.refreshHearts()
      all.forEach((o, k) => o.setState(k === q.answer ? 'right' : k === i ? 'wrong' : 'off'))
      this.tmp(this.txt(32, bottom, q.why, 13, ok ? COLORS.goodHex : COLORS.text, { wrap: 600 }))
      if (this.wrong >= COUNCIL_HEARTS) {
        this.time.delayedCall(1500, () => this.levelFailed('El Consejo perdió la confianza. Sé breve, honesto y habla de impacto en el negocio.', () => this.startCouncil()))
        return
      }
      this.cardButton(700, 470, 150, 28, this.idx + 1 < COUNCIL_QS.length ? 'Siguiente →' : 'Veredicto', () => {
        this.idx++
        this.showQ()
      }, { size: 13 })
    }, 13, 6)
  }

  private endCouncil() {
    const s = councilStars(this.wrong)
    if (!s) return this.levelFailed('Demasiadas respuestas poco ejecutivas.', () => this.startCouncil())
    this.levelDone(s, 2, () => {}, `${this.wrong} respuesta(s) mejorable(s). El Consejo confía en tu criterio.`)
  }
}
