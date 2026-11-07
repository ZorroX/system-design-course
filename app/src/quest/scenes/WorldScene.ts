import * as Phaser from 'phaser'
import { SOLID, T, TILE } from '../art'
import { bus, setBlocking, touch, ui, type DialogLine } from '../bus'
import { chip } from '../audio'
import { CRYSTAL, GATES, MAP_H, MAP_W, NPCS, PILLARS, SCROLLS, SEALS, SHRINES, SIGNS, START, buildMap, regionAt, type GateDef, type NpcDef, type ScrollDef, type ShrineDef } from '../world/map'
import { CODEX, INTRO, NAMES, PUZZLE_META, guardianLines, npcLines, pillarCount } from '../story'
import { PUZZLE_SCENE } from './common'
import { PUZZLES, TREASURY, useGame, type PuzzleId } from '@/store/game'

type Facing = 'down' | 'up' | 'left' | 'right'
const SPEED = 74
const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const q = () => useGame.getState().quest

interface NpcObj {
  def: NpcDef
  sprite: Phaser.Types.Physics.Arcade.SpriteWithStaticBody
  bubble: Phaser.GameObjects.Image
  shadow: Phaser.GameObjects.Image
}
interface GateObj {
  def: GateDef
  parts: Phaser.Types.Physics.Arcade.ImageWithStaticBody[]
  open: boolean
}

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private playerShadow!: Phaser.GameObjects.Image
  private layer!: Phaser.Tilemaps.TilemapLayer
  private map!: Phaser.Tilemaps.Tilemap
  private npcs: NpcObj[] = []
  private scrolls: { def: ScrollDef; sprite: Phaser.GameObjects.Image }[] = []
  private gates: GateObj[] = []
  private blockers!: Phaser.Physics.Arcade.StaticGroup
  private crystal!: Phaser.GameObjects.Image
  private glow!: Phaser.GameObjects.Arc
  private fog!: Phaser.GameObjects.Rectangle
  private facing: Facing = 'down'
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private lastPrompt: string | null = null
  private lastRegion = ''
  private touchActionPrev = false
  private saveAcc = 0
  private waterFlip = false
  private litPillars = new Set<PuzzleId>()

  constructor() {
    super('world')
  }

  create() {
    const grid = buildMap()
    this.map = this.make.tilemap({ data: grid, tileWidth: TILE, tileHeight: TILE })
    const tileset = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!
    this.layer = this.map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer
    this.layer.setCollision(SOLID)
    this.blockers = this.physics.add.staticGroup()

    // Cristal y su brillo
    const [cx, cy] = CRYSTAL
    this.glow = this.add.circle(cx * TILE + 8, cy * TILE - 2, 22, 0x7ef0ff, 0.15).setDepth(cy * TILE - 1)
    this.crystal = this.add.image(cx * TILE + 8, cy * TILE + 10, 'objs', 'crystal').setOrigin(0.5, 1).setDepth(cy * TILE + 10)
    this.tweens.add({ targets: this.crystal, y: '-=2', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    // Pergaminos
    for (const s of SCROLLS) {
      if (q().scrolls.includes(s.id)) continue
      const sprite = this.add.image(s.x * TILE + 8, s.y * TILE + 8, 'objs', 'scroll').setDepth(s.y * TILE + 8)
      this.tweens.add({ targets: sprite, y: '-=3', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      this.scrolls.push({ def: s, sprite })
    }

    // Nieblas
    const pillars = pillarCount(q())
    for (const g of GATES) {
      const open = pillars >= g.req
      const parts = open ? [] : g.cells.map(([x, y]) => this.makeFog(x, y))
      this.gates.push({ def: g, parts, open })
    }

    // Personajes
    for (const def of NPCS) {
      const sprite = this.physics.add.staticSprite(def.x * TILE + 8, def.y * TILE + 8, 'chars', `${def.look}_down0`)
      sprite.body.setSize(12, 10).setOffset(2, 6)
      const shadow = this.add.image(sprite.x, sprite.y + 7, 'objs', 'shadow').setDepth(sprite.y - 1)
      this.face(sprite, def.look, def.face)
      sprite.setDepth(sprite.y)
      const bubble = this.add.image(sprite.x, sprite.y - 14, 'objs', 'bubble').setDepth(9000).setVisible(false)
      this.tweens.add({ targets: bubble, y: '-=2', duration: 500, yoyo: true, repeat: -1 })
      this.npcs.push({ def, sprite, bubble, shadow })
    }

    // Jugador
    const pos = q().pos ?? { x: START[0], y: START[1] }
    this.player = this.physics.add.sprite(pos.x * TILE + 8, pos.y * TILE + 8, 'chars', 'hero_down0')
    this.player.body.setSize(10, 6).setOffset(3, 10)
    this.player.setCollideWorldBounds(true)
    this.playerShadow = this.add.image(this.player.x, this.player.y + 7, 'objs', 'shadow')
    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE)
    this.physics.add.collider(this.player, this.layer)
    this.physics.add.collider(this.player, this.blockers)
    for (const n of this.npcs) this.physics.add.collider(this.player, n.sprite)

    // Cámara y niebla de latencia
    const cam = this.cameras.main
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE)
    cam.startFollow(this.player, true, 0.12, 0.12)
    cam.setRoundPixels(true)
    this.fog = this.add.rectangle(0, 0, 10, 10, 0x4b3f72, 0).setOrigin(0).setScrollFactor(0).setDepth(9500)
    this.fitCamera()
    this.scale.on('resize', this.fitCamera, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.fitCamera, this))

    // Entrada
    const kb = this.input.keyboard!
    this.cursors = kb.createCursorKeys()
    this.keys = kb.addKeys('W,A,S,D,E,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>
    kb.removeCapture('SPACE,ENTER') // no robar estas teclas a los botones de React

    this.time.addEvent({ delay: 650, loop: true, callback: () => this.animateWater() })
    this.events.on('resume', () => this.refreshProgress(true))
    this.refreshProgress(false)

    chip.play('world')
    bus.emit('scene', 'world')
    if (!q().started) this.time.delayedCall(500, () => this.openIntro())
  }

  /* ----------------------------- helpers ----------------------------- */
  private makeFog(x: number, y: number) {
    const f = this.physics.add.staticImage(x * TILE + 8, y * TILE + 8, 'objs', 'fog').setDepth(y * TILE + 9)
    this.blockers.add(f)
    this.tweens.add({ targets: f, alpha: { from: 0.75, to: 1 }, duration: 900 + Math.random() * 600, yoyo: true, repeat: -1 })
    return f
  }

  private fitCamera() {
    const cam = this.cameras.main
    const w = this.scale.width
    const h = this.scale.height
    const zoom = Phaser.Math.Clamp(Math.round(Math.min(w / (TILE * 20), h / (TILE * 13)) * 2) / 2, 2, 6)
    cam.setZoom(zoom)
    this.fog.setSize(w / zoom + 4, h / zoom + 4)
    this.fog.setPosition(-2, -2)
  }

  private face(sprite: Phaser.GameObjects.Sprite, look: string, f: Facing) {
    sprite.setFrame(`${look}_${f === 'left' || f === 'right' ? 'side' : f}0`)
    sprite.setFlipX(f === 'left')
  }

  private animateWater() {
    this.waterFlip = !this.waterFlip
    if (this.waterFlip) this.layer.replaceByIndex(T.WATER, T.WATER2)
    else this.layer.replaceByIndex(T.WATER2, T.WATER)
  }

  private dialog(lines: DialogLine[], choices?: string[], onClose?: (c: number) => void) {
    setBlocking(true)
    this.player.setVelocity(0, 0)
    this.player.anims.stop()
    bus.emit('dialog', {
      lines,
      choices,
      onClose: (c) => {
        setBlocking(false)
        onClose?.(c)
      },
    })
  }

  private openIntro() {
    this.dialog(INTRO, undefined, () => {
      useGame.getState().questUpdate({ started: true })
      useGame.getState().questCodex('monolith')
      // pequeño gesto para que el XP del logro aparezca
      useGame.getState().addXp(10, 'Comienza la aventura')
      bus.emit('toast', { text: 'Códice: El Gran Cristal', icon: '💎' })
    })
  }

  /** Enciende pilares, disipa nieblas y actualiza marcadores según el progreso guardado. */
  private refreshProgress(animate: boolean) {
    const st = q()
    const count = pillarCount(st)
    for (const id of [...PUZZLES, ...TREASURY]) {
      const on = (st.pillars[id] ?? 0) > 0
      const pos = PILLARS[id] ?? SEALS[id]
      if (!pos) continue
      const [x, y] = pos
      this.layer.putTileAt(on ? T.PILLAR_ON : T.PILLAR_OFF, x, y)
      if (on && !this.litPillars.has(id)) {
        this.litPillars.add(id)
        if (animate) this.sparkleAt(x * TILE + 8, y * TILE + 2)
      }
    }
    // brillo del cristal y niebla global
    this.glow.setRadius(18 + count * 5).setAlpha(0.12 + count * 0.07)
    this.fog.setAlpha(st.bossStars > 0 ? 0 : 0.32 * (1 - count / 5))
    // nieblas de los pasillos
    for (const g of this.gates) {
      if (g.open || count < g.def.req) continue
      g.open = true
      for (const p of g.parts) {
        p.body.enable = false
        if (animate)
          this.tweens.add({ targets: p, alpha: 0, scale: 1.8, duration: 1200, delay: Math.random() * 300, onComplete: () => p.destroy() })
        else p.destroy()
      }
      if (animate) {
        const names: Record<string, string> = { north: 'del norte', west: 'del oeste', east: 'del este', south: 'del sur', citadel: 'de la Ciudadela' }
        bus.emit('toast', { text: `La niebla ${names[g.def.id]} se disipa`, icon: '🌫️' })
      }
    }
    // marcadores "!" en guardianes con prueba pendiente y accesible
    for (const n of this.npcs) {
      const shrine = SHRINES.find((s) => s.guardian === n.def.id)
      let show = false
      if (n.def.id === 'ada') show = !st.started
      else if (shrine) {
        const solved = shrine.puzzle === 'boss' ? st.bossStars > 0 : (st.pillars[shrine.puzzle] ?? 0) > 0
        // solo si su región ya es accesible (misma regla que las nieblas)
        const access: Record<string, number> = { inn: 0, library: 1, harbor: 1, ring: 2, bridge: 3, boss: 5 }
        show = !solved && st.started && count >= (access[shrine.puzzle] ?? 0)
      }
      n.bubble.setVisible(show)
    }
    if (animate && st.bossStars > 0) this.cameras.main.flash(800, 200, 255, 255)
  }

  private sparkleAt(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const s = this.add.image(x, y, 'objs', 'sparkle').setDepth(9100)
      const a = (i / 10) * Math.PI * 2
      this.tweens.add({ targets: s, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, alpha: 0, duration: 900, delay: 400, onComplete: () => s.destroy() })
    }
    this.cameras.main.flash(300, 126, 240, 255)
  }

  /* ----------------------------- interacción ----------------------------- */
  private frontPoint(): [number, number] {
    // punto dentro de la casilla adyacente en la dirección en la que mira el jugador
    const { x, y } = this.player
    switch (this.facing) {
      case 'up':
        return [x, y - 10]
      case 'down':
        return [x, y + 16]
      case 'left':
        return [x - 14, y + 4]
      case 'right':
        return [x + 14, y + 4]
    }
  }

  private findTarget(): { label: string; run: () => void } | null {
    const [fx, fy] = this.frontPoint()
    // personajes
    for (const n of this.npcs) {
      if (Phaser.Math.Distance.Between(fx, fy, n.sprite.x, n.sprite.y) < 13) return { label: `Hablar con ${NAMES[n.def.id] ?? 'el aldeano'}`, run: () => this.talk(n) }
    }
    const tx = Math.floor(fx / TILE)
    const ty = Math.floor(fy / TILE)
    const tile = this.layer.getTileAt(tx, ty)?.index
    const shrine = SHRINES.find((s) => s.x === tx && s.y === ty)
    if (shrine) return { label: `Entrar: ${PUZZLE_META[shrine.puzzle].title}`, run: () => this.offerPuzzle(shrine) }
    const sign = SIGNS.find((s) => s.x === tx && s.y === ty)
    if (sign) return { label: 'Leer el letrero', run: () => this.dialog([{ who: 'Letrero', text: sign.text }]) }
    if (tx === CRYSTAL[0] && ty === CRYSTAL[1]) return { label: 'Observar el Gran Cristal', run: () => this.lookCrystal() }
    if (tile === T.PILLAR_OFF || tile === T.PILLAR_ON) {
      const all = { ...PILLARS, ...SEALS }
      const id = (Object.keys(all) as PuzzleId[]).find((k) => all[k]![0] === tx && all[k]![1] === ty)
      if (id) return { label: TREASURY.includes(id) ? 'Examinar el sello' : 'Examinar el pilar', run: () => this.lookPillar(id) }
    }
    if (tile === T.BROKEN) return { label: 'Mirar el puente', run: () => this.dialog([{ who: 'Tú', portrait: 'hero', text: 'El puente está partido. Al otro lado, el Sur sigue con su propio libro de cuentas…' }]) }
    return null
  }

  private talk(n: NpcObj) {
    // gira hacia el jugador
    const dx = this.player.x - n.sprite.x
    const dy = this.player.y - n.sprite.y
    this.face(n.sprite, n.def.look, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
    chip.sfx('talk')
    const shrine = SHRINES.find((s) => s.guardian === n.def.id)
    const restore = () => this.face(n.sprite, n.def.look, n.def.face)
    if (n.def.id === 'ada' && !q().started) return this.openIntro()
    if (shrine) return this.offerPuzzle(shrine, restore)
    const st = useGame.getState()
    if (!st.quest.talked.includes(n.def.id)) st.questUpdate({ talked: [...st.quest.talked, n.def.id] })
    this.dialog(npcLines(n.def.id, st.quest), undefined, restore)
  }

  private offerPuzzle(shrine: ShrineDef, after?: () => void) {
    const st = q()
    if (shrine.puzzle === 'boss' && pillarCount(st) < 5) {
      this.dialog(npcLines('guard-citadel', st), undefined, after)
      return
    }
    const solved = shrine.puzzle === 'boss' ? st.bossStars > 0 : (st.pillars[shrine.puzzle] ?? 0) > 0
    const stars = shrine.puzzle === 'boss' ? st.bossStars : (st.pillars[shrine.puzzle] ?? 0)
    const lines = guardianLines(shrine.puzzle, solved)
    const choices = solved ? [`Repetir la prueba (mejor: ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)})`, 'Ahora no'] : ['¡Acepto el desafío!', 'Todavía no']
    this.dialog(lines, choices, (c) => {
      after?.()
      if (c === 0) this.startPuzzle(shrine.puzzle)
    })
  }

  private startPuzzle(id: PuzzleId | 'boss') {
    this.savePosition()
    this.player.setVelocity(0, 0)
    this.player.anims.stop()
    bus.emit('prompt', null)
    this.lastPrompt = null
    chip.sfx('door')
    chip.play(id === 'boss' ? 'boss' : 'puzzle')
    bus.emit('scene', 'puzzle')
    this.cameras.main.fadeOut(250, 11, 16, 32)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.launch(PUZZLE_SCENE[id])
      this.scene.pause()
      this.cameras.main.fadeIn(0)
    })
  }

  private lookCrystal() {
    const c = pillarCount(q())
    const text =
      c === 0
        ? 'El Gran Cristal parpadea, agotado. Miles de peticiones esperan dentro, como una fila que no avanza.'
        : c < 5
          ? `El cristal brilla un poco más: ${c} de 5 pilares comparten ya su carga.`
          : 'El cristal resplandece en calma. Ya no está solo.'
    this.dialog([{ who: 'Gran Cristal', text }])
  }

  private lookPillar(id: PuzzleId) {
    const stars = q().pillars[id] ?? 0
    const meta = PUZZLE_META[id]
    const kind = TREASURY.includes(id) ? 'Sello' : 'Pilar'
    this.dialog([{ who: `${kind} · ${meta.title}`, text: stars ? `Encendido ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}. ${meta.lesson}` : `Apagado. Su prueba te espera en ${meta.where}.` }])
  }

  private savePosition() {
    const x = Math.floor(this.player.x / TILE)
    const y = Math.floor((this.player.y + 4) / TILE)
    const cur = q().pos
    if (!cur || cur.x !== x || cur.y !== y) useGame.getState().questUpdate({ pos: { x, y } })
  }

  private collectScroll(i: number) {
    const s = this.scrolls[i]
    this.scrolls.splice(i, 1)
    chip.sfx('pickup')
    this.tweens.add({ targets: s.sprite, y: s.sprite.y - 14, alpha: 0, scale: 1.6, duration: 500, onComplete: () => s.sprite.destroy() })
    useGame.getState().questScroll(s.def.id, s.def.codex)
    const entry = CODEX[s.def.codex]
    this.dialog([{ who: `Pergamino · ${entry.title}`, text: entry.text }])
  }

  /* ----------------------------- bucle ----------------------------- */
  update(_time: number, delta: number) {
    const p = this.player
    this.playerShadow.setPosition(p.x, p.y + 7).setDepth(p.y - 1)
    p.setDepth(p.y)
    if (ui.blocking) {
      p.setVelocity(0, 0)
      return
    }
    const k = this.keys
    const left = this.cursors.left.isDown || k.A.isDown || touch.left
    const right = this.cursors.right.isDown || k.D.isDown || touch.right
    const up = this.cursors.up.isDown || k.W.isDown || touch.up
    const down = this.cursors.down.isDown || k.S.isDown || touch.down
    let vx = (right ? 1 : 0) - (left ? 1 : 0)
    let vy = (down ? 1 : 0) - (up ? 1 : 0)
    if (vx && vy) {
      vx *= Math.SQRT1_2
      vy *= Math.SQRT1_2
    }
    p.setVelocity(vx * SPEED, vy * SPEED)
    if (vx || vy) {
      if (Math.abs(vx) > Math.abs(vy)) this.facing = vx > 0 ? 'right' : 'left'
      else this.facing = vy > 0 ? 'down' : 'up'
      const dir = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing
      p.anims.play(`hero-walk-${dir}`, true)
      p.setFlipX(this.facing === 'left')
    } else {
      p.anims.stop()
      p.setFrame(`hero_${this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing}0`)
    }

    // región
    const tx = Math.floor(p.x / TILE)
    const ty = Math.floor((p.y + 4) / TILE)
    const reg = regionAt(tx, ty)
    if (reg && reg.id !== this.lastRegion) {
      this.lastRegion = reg.id
      bus.emit('region', reg.name)
    }

    // pergaminos
    for (let i = this.scrolls.length - 1; i >= 0; i--) {
      const s = this.scrolls[i]
      if (Phaser.Math.Distance.Between(p.x, p.y + 4, s.sprite.x, s.sprite.y) < 11) {
        this.collectScroll(i)
        return
      }
    }

    // interacción
    const target = this.findTarget()
    const label = target ? `${COARSE ? 'Ⓐ' : 'E'} · ${target.label}` : null
    if (label !== this.lastPrompt) {
      this.lastPrompt = label
      bus.emit('prompt', label)
    }
    const actionDown = Phaser.Input.Keyboard.JustDown(k.E) || Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.ENTER) || (touch.action && !this.touchActionPrev)
    this.touchActionPrev = touch.action
    if (actionDown && target && performance.now() - ui.releasedAt > 250) target.run()

    // guardado periódico
    this.saveAcc += delta
    if (this.saveAcc > 3000) {
      this.saveAcc = 0
      this.savePosition()
    }
  }
}
