import * as Phaser from 'phaser'
import { BasePuzzle, COLORS, type Button } from './BasePuzzle'
import { BossModel, CORE, MONSTERS, PATH, SLOTS, TOWERS, UPGRADE_COST, WAVES, type MonsterKind, type TowerKind } from '../models/boss'
import { chip } from '../audio'

const TOWER_COLOR: Record<TowerKind, number> = { cache: 0xfbbf24, cdn: 0x22d3ee, limiter: 0xf87171, queue: 0xf472b6, breaker: 0x34d399 }
const KINDS: TowerKind[] = ['cache', 'cdn', 'queue', 'limiter', 'breaker']

export class BossScene extends BasePuzzle {
  readonly puzzleId = 'boss' as const
  private model!: BossModel
  private acc = 0
  private monsters = new Map<number, Phaser.GameObjects.Image>()
  private towers: (Phaser.GameObjects.Container | null)[] = []
  private fx!: Phaser.GameObjects.Graphics
  private beams: { x1: number; y1: number; x2: number; y2: number; t: number; color: number }[] = []
  private hud!: Phaser.GameObjects.Text
  private hpBar!: Phaser.GameObjects.Graphics
  private banner!: Phaser.GameObjects.Text
  private startBtn!: Button
  private popup: { objs: Phaser.GameObjects.GameObject[]; btns: Button[] } | null = null
  private ended = false

  constructor() {
    super('boss')
  }

  protected build() {
    this.model = new BossModel()
    this.monsters.clear()
    this.towers = SLOTS.map(() => null)
    this.beams = []
    this.ended = false
    this.drawBoard()
    this.paused = true
    void this.brief({
      title: 'La Horda del Viernes Negro',
      icon: '🐉',
      goal: 'Protege el Núcleo de Datos durante 3 oleadas.',
      how: [
        'Toca un hueco junto al camino para construir una defensa. Toca una defensa para mejorarla (6🪙).',
        'Cada defensa sirve contra un tipo de petición: ⚡ Caché → lecturas (azules) · 🌍 CDN → imágenes (amarillas) · 📨 Cola → escrituras (rojas) · 🚦 Rate limiter → bots (violetas).',
        '🛡️ Circuit breaker: no ataca a nadie, pero te salva cuando un servicio se cae.',
        'Ganas oro con cada petición atendida y al terminar cada oleada.',
      ],
      concept: 'El jefe final combina todo: [[cdn|CDN]], [[cache-aside|caché]], [[queue|colas]], [[rate-limit|rate limiting]] y [[circuit-breaker|circuit breaker]]. Ningún patrón solo sobrevive a un pico.',
      button: 'Preparar defensas',
    })
  }

  /* ------------------------------ tablero ------------------------------ */
  private drawBoard() {
    const g = this.add.graphics()
    g.fillStyle(0x15281c, 1).fillRoundedRect(4, 48, this.W - 8, this.H - 52, 10)
    // camino
    for (const [w, col] of [[44, 0x5a4026], [34, 0x8a6a42]] as [number, number][]) {
      g.lineStyle(w, col, 1)
      g.beginPath()
      g.moveTo(PATH[0][0], PATH[0][1])
      for (const [x, y] of PATH.slice(1)) g.lineTo(x, y)
      g.strokePath()
      for (const [x, y] of PATH) g.fillStyle(col, 1).fillCircle(x, y, w / 2)
    }
    this.txt(10, PATH[0][1] + 26, 'Internet →', 12, COLORS.muted)
    // núcleo
    g.fillStyle(0x1b2547, 1).fillCircle(CORE.x, CORE.y, 40)
    g.lineStyle(3, 0x7ef0ff, 1).strokeCircle(CORE.x, CORE.y, 40)
    const crystal = this.add.image(CORE.x, CORE.y + 22, 'objs', 'crystal').setScale(2).setOrigin(0.5, 1)
    this.tweens.add({ targets: crystal, y: CORE.y + 18, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.txt(CORE.x, CORE.y + 48, 'Núcleo de Datos', 12, COLORS.text, { bold: true }).setOrigin(0.5, 0)
    this.hpBar = this.add.graphics()
    // huecos
    SLOTS.forEach(([x, y], i) => {
      g.lineStyle(2, 0x7ef0ff, 0.35).strokeCircle(x, y, 22)
      g.fillStyle(0x0b1020, 0.4).fillCircle(x, y, 22)
      const z = this.add.zone(x, y, 48, 48).setInteractive({ useHandCursor: true })
      z.on('pointerdown', () => this.openSlot(i))
    })
    // leyenda
    const kinds: MonsterKind[] = ['read', 'static', 'write', 'bot']
    kinds.forEach((k, i) => {
      this.add.image(24, 422 + i * 18, 'objs', k).setScale(1)
      this.txt(36, 422 + i * 18, `${MONSTERS[k].label} · daño ${MONSTERS[k].dmg}`, 11, COLORS.muted).setOrigin(0, 0.5)
    })
    this.fx = this.add.graphics().setDepth(100)
    this.hud = this.txt(16, 62, '', 15, COLORS.text, { bold: true })
    this.banner = this.txt(this.W / 2 - 40, 82, '', 15, COLORS.badHex, { bold: true }).setOrigin(0.5, 0).setDepth(200)
    this.startBtn = this.button(690, 466, 190, 40, '▶ Oleada 1', () => this.startWave(), {})
  }

  private async startWave() {
    if (this.model.phase !== 'build') return
    this.closePopup()
    const w = WAVES[this.model.wave]
    await this.brief({ title: w.name, icon: '⚔️', goal: 'Que no llegue nada al Núcleo.', how: [w.intro], button: '¡Que vengan!' })
    this.model.startWave()
    this.startBtn.setEnabled(false)
    this.startBtn.setLabel('En curso…')
  }

  /* ------------------------------ tienda ------------------------------ */
  private closePopup() {
    if (!this.popup) return
    this.popup.objs.forEach((o) => o.destroy())
    this.popup.btns.forEach((b) => b.destroy())
    this.popup = null
  }

  private openSlot(i: number) {
    if (this.ended) return
    this.closePopup()
    const [sx, sy] = SLOTS[i]
    const tower = this.model.towers[i]
    const objs: Phaser.GameObjects.GameObject[] = []
    const btns: Button[] = []
    const shade = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.25).setInteractive().setDepth(300)
    shade.on('pointerdown', () => this.closePopup())
    objs.push(shade)
    const w = 280
    const h = tower ? 150 : 52 + KINDS.length * 46
    const px = Phaser.Math.Clamp(sx + 30, 10, this.W - w - 10)
    const py = Phaser.Math.Clamp(sy - h / 2, 52, this.H - h - 6)
    objs.push(this.panel(px, py, w, h, COLORS.panel, 0.98, 0x3b4a80).setDepth(301))
    if (!tower) {
      objs.push(this.txt(px + 14, py + 12, `Construir (tienes ${Math.floor(this.model.gold)}🪙)`, 14, COLORS.text, { bold: true }).setDepth(302))
      KINDS.forEach((k, j) => {
        const spec = TOWERS[k]
        const can = this.model.canBuild(i, k)
        const b = this.button(px + w / 2, py + 62 + j * 46, w - 24, 40, `${spec.icon} ${spec.name} · ${spec.cost}🪙`, () => {
          if (this.model.build(i, k)) {
            chip.sfx('build')
            this.drawTower(i)
            this.closePopup()
          }
        }, { color: COLORS.panel2, size: 13 })
        b.setEnabled(can)
        b.container.setDepth(303)
        btns.push(b)
      })
    } else {
      const spec = TOWERS[tower.kind]
      objs.push(this.txt(px + 14, py + 12, `${spec.icon} ${spec.name} · nivel ${tower.level}`, 15, COLORS.text, { bold: true }).setDepth(302))
      objs.push(this.txt(px + 14, py + 38, spec.desc + (tower.kind === 'breaker' ? '.' : `. Rango ${this.model.rangeOf(tower)}.`), 12, COLORS.muted, { wrap: w - 28 }).setDepth(302))
      if (tower.kind !== 'breaker') {
        const b = this.button(px + w / 2, py + h - 34, w - 24, 38, tower.level === 2 ? 'Nivel máximo' : `⬆ Mejorar: +rango, +velocidad (${UPGRADE_COST}🪙)`, () => {
          if (this.model.upgrade(i)) {
            chip.sfx('build')
            this.drawTower(i)
            this.closePopup()
          }
        }, { size: 12 })
        b.setEnabled(this.model.canUpgrade(i))
        b.container.setDepth(303)
        btns.push(b)
      }
    }
    this.popup = { objs, btns }
  }

  private drawTower(i: number) {
    this.towers[i]?.destroy()
    const t = this.model.towers[i]
    if (!t) return
    const [x, y] = SLOTS[i]
    const g = this.add.graphics()
    g.fillStyle(TOWER_COLOR[t.kind], 1).fillCircle(0, 0, 20)
    g.lineStyle(3, t.level === 2 ? 0xffffff : 0x1d1a2b, 1).strokeCircle(0, 0, 20)
    const icon = this.txt(0, 1, TOWERS[t.kind].icon, 20).setOrigin(0.5)
    const items: Phaser.GameObjects.GameObject[] = [g, icon]
    if (t.level === 2) items.push(this.txt(14, -16, '★', 13, '#ffffff', { bold: true }).setOrigin(0.5))
    const c = this.add.container(x, y, items).setDepth(50)
    this.tweens.add({ targets: c, scale: { from: 0.4, to: 1 }, duration: 250, ease: 'Back.out' })
    this.towers[i] = c
  }

  /* ------------------------------ bucle ------------------------------ */
  update(_t: number, delta: number) {
    if (!this.model) return
    const dt = Math.min(0.1, delta / 1000)
    const m = this.model
    if (!this.paused && m.phase === 'wave') {
      this.acc += dt
      while (this.acc >= 1 / 30) {
        this.acc -= 1 / 30
        m.step(1 / 30)
      }
      this.handleEvents()
    }
    // monstruos
    const alive = new Set<number>()
    for (const mo of m.monsters) {
      alive.add(mo.id)
      let s = this.monsters.get(mo.id)
      if (!s) {
        s = this.add.image(0, 0, 'objs', mo.kind).setScale(2).setDepth(40)
        this.monsters.set(mo.id, s)
      }
      const [x, y] = m.position(mo)
      s.setPosition(x, y + Math.sin(this.time.now / 120 + mo.id) * 2)
    }
    for (const [id, s] of this.monsters) {
      if (alive.has(id)) continue
      this.tweens.add({ targets: s, scale: 0, alpha: 0, duration: 180, onComplete: () => s.destroy() })
      this.monsters.delete(id)
    }
    // rayos y rangos
    const fx = this.fx
    fx.clear()
    if (m.phase === 'build') {
      m.towers.forEach((t, i) => {
        if (!t || t.kind === 'breaker') return
        fx.lineStyle(1.5, TOWER_COLOR[t.kind], 0.35).strokeCircle(SLOTS[i][0], SLOTS[i][1], m.rangeOf(t))
      })
    }
    this.beams = this.beams.filter((b) => (b.t -= dt) > 0)
    for (const b of this.beams) fx.lineStyle(3, b.color, b.t * 4).lineBetween(b.x1, b.y1, b.x2, b.y2)
    // HUD
    const hpFrac = m.hp / m.maxHp
    this.hpBar.clear()
    this.hpBar.fillStyle(0x1b2547, 1).fillRect(CORE.x - 40, CORE.y - 58, 80, 8)
    this.hpBar.fillStyle(hpFrac > 0.5 ? 0x34d399 : hpFrac > 0.25 ? 0xfbbf24 : 0xf87171, 1).fillRect(CORE.x - 40, CORE.y - 58, 80 * hpFrac, 8)
    const waveLabel = m.phase === 'won' ? 'Victoria' : `Oleada ${Math.min(m.wave + 1, WAVES.length)}/${WAVES.length}`
    this.hud.setText(`${waveLabel}   ·   ❤️ ${m.hp}/${m.maxHp}   ·   🪙 ${Math.floor(m.gold)}${m.phase === 'build' ? '   ·   Fase de construcción' : ''}`)
    if (m.outage) this.banner.setText(m.hasBreaker() ? '🛡️ ¡Pagos caído! Circuit breaker abierto: fallback activo' : '⚠️ ¡PAGOS CAÍDO! Hilos bloqueados: el Núcleo sufre').setColor(m.hasBreaker() ? COLORS.goodHex : COLORS.badHex).setAlpha(0.6 + 0.4 * Math.sin(this.time.now / 120))
    else this.banner.setText('')
  }

  private handleEvents() {
    const m = this.model
    for (const e of m.events) {
      switch (e.type) {
        case 'absorb': {
          const [tx, ty] = SLOTS[e.tower]
          const kind = m.towers[e.tower]?.kind ?? 'cache'
          this.beams.push({ x1: tx, y1: ty, x2: e.x, y2: e.y, t: 0.25, color: TOWER_COLOR[kind] })
          break
        }
        case 'block': {
          const s = this.monsters.get(e.monster)
          if (s) this.floatText(s.x, s.y - 14, '✋ 429', COLORS.badHex, 12)
          break
        }
        case 'hit':
          chip.sfx('bad')
          this.cameras.main.shake(120, 0.006)
          this.floatText(CORE.x, CORE.y - 70, `-${e.dmg}`, COLORS.badHex, 18)
          break
        case 'outage':
          if (e.on) {
            chip.sfx('fire')
            this.cameras.main.flash(250, 255, 60, 60)
          }
          break
        case 'waveEnd':
          if (m.phase === 'build' || m.wave < WAVES.length) {
            chip.sfx('ok')
            this.floatText(this.W / 2, 140, `¡${WAVES[e.wave].name} superada! +6🪙`, COLORS.goodHex, 18)
            this.startBtn.setEnabled(true)
            this.startBtn.setLabel(`▶ Oleada ${Math.min(m.wave + 1, WAVES.length)}`)
          }
          break
        case 'won':
          this.ended = true
          this.startBtn.setEnabled(false)
          this.time.delayedCall(700, () => this.finish(m.stars()))
          break
        case 'lost':
          this.ended = true
          this.startBtn.setEnabled(false)
          this.time.delayedCall(500, () =>
            this.levelFailed(
              m.wave === 2 && m.outage && !m.hasBreaker()
                ? 'El Núcleo cayó durante la caída de Pagos. Sin circuit breaker, cada petición esperaba un timeout y los hilos bloqueados lo hundieron. Construye un 🛡️ antes de la oleada 3.'
                : 'El Núcleo cayó. Revisa qué peticiones llegaron: cada tipo necesita su defensa, y las mejoras (★) hacen a las torres más rápidas.',
              () => this.scene.restart(),
            ),
          )
          break
      }
    }
    m.events = []
  }
}
