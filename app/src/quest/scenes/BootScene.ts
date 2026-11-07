import * as Phaser from 'phaser'
import { CHAR_FRAMES, OBJ, generateArt } from '../art'

/** Convierte el arte procedural (canvas) en texturas y animaciones de Phaser. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create() {
    const art = generateArt()
    if (!this.textures.exists('tiles')) {
      this.textures.addCanvas('tiles', art.tiles)
      const chars = this.textures.addCanvas('chars', art.chars)!
      art.charIds.forEach((id, row) => CHAR_FRAMES.forEach(([d, f], col) => chars.add(`${id}_${d}${f}`, 0, col * 16, row * 16, 16, 16)))
      const objs = this.textures.addCanvas('objs', art.objects)!
      for (const [k, [x, y, w, h]] of Object.entries(OBJ)) objs.add(k, 0, x, y, w, h)
    }
    for (const id of art.charIds) {
      for (const dir of ['down', 'up', 'side'] as const) {
        const key = `${id}-walk-${dir}`
        if (this.anims.exists(key)) continue
        this.anims.create({
          key,
          frames: [1, 0, 2, 0].map((f) => ({ key: 'chars', frame: `${id}_${dir}${f}` })),
          frameRate: 8,
          repeat: -1,
        })
      }
    }
    this.scene.start('world')
  }
}
