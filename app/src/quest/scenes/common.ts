import type * as Phaser from 'phaser'
import { bus, setBlocking } from '../bus'
import { chip } from '../audio'
import { CODEX, PUZZLE_META } from '../story'
import { useGame, type PuzzleId } from '@/store/game'

export const PUZZLE_SCENE: Record<PuzzleId | 'boss', string> = {
  inn: 'inn',
  library: 'library',
  ring: 'ring',
  harbor: 'harbor',
  bridge: 'bridge',
  boss: 'boss',
  vault: 'vault',
  forge: 'forge',
  tower: 'tower',
  caravan: 'caravan',
  aviary: 'aviary',
  council: 'council',
}

/** Termina un puzle: guarda estrellas, desbloquea el códice, muestra el resultado y vuelve al mundo. */
export function endPuzzle(scene: Phaser.Scene, id: PuzzleId | 'boss', stars: number) {
  const st = useGame.getState()
  const meta = PUZZLE_META[id]
  if (stars > 0) {
    st.questSolve(id, stars)
    for (const c of meta.codex) if (CODEX[c]) useGame.getState().questCodex(c)
    chip.sfx('win')
  }
  setBlocking(true)
  bus.emit('result', {
    puzzle: id,
    stars,
    title: meta.title,
    lesson: meta.lesson,
    onClose: () => {
      setBlocking(false)
      returnToWorld(scene)
    },
  })
}

export function returnToWorld(scene: Phaser.Scene) {
  scene.scene.stop()
  scene.scene.resume('world')
  chip.play('world')
  bus.emit('scene', 'world')
}
