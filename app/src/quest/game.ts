import * as Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { WorldScene } from './scenes/WorldScene'
import { InnScene } from './scenes/InnScene'
import { LibraryScene } from './scenes/LibraryScene'
import { RingScene } from './scenes/RingScene'
import { HarborScene } from './scenes/HarborScene'
import { BridgeScene } from './scenes/BridgeScene'
import { BossScene } from './scenes/BossScene'
import { VaultScene } from './scenes/VaultScene'
import { ForgeScene } from './scenes/ForgeScene'
import { TowerScene } from './scenes/TowerScene'
import { CaravanScene } from './scenes/CaravanScene'
import { AviaryScene } from './scenes/AviaryScene'
import { CouncilScene } from './scenes/CouncilScene'

export async function createGame(parent: HTMLElement): Promise<Phaser.Game> {
  // Las escenas usan estas fuentes en los textos del canvas: esperamos a que carguen.
  try {
    await Promise.all([document.fonts.load('16px "Press Start 2P"'), document.fonts.load('bold 16px Inter'), document.fonts.load('16px Inter')])
  } catch {
    /* sin fuentes web: se usa la fuente del sistema */
  }
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b1020',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    input: { activePointers: 3 },
    audio: { noAudio: true },
    banner: false,
    scene: [BootScene, WorldScene, InnScene, LibraryScene, RingScene, HarborScene, BridgeScene, BossScene, VaultScene, ForgeScene, TowerScene, CaravanScene, AviaryScene, CouncilScene],
  })
}
