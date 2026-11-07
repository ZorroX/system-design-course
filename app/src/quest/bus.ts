/**
 * Bus de eventos entre el juego (Phaser, canvas) y la interfaz (React, DOM).
 * Phaser dibuja el mundo y los puzles; React muestra diálogos, códice, HUD y briefings,
 * donde el texto se ve nítido y puede llevar tooltips del glosario.
 */
import type { PuzzleId } from '@/store/game'

export interface DialogLine {
  who: string
  portrait?: string // id de personaje para el retrato
  text: string
}
export interface DialogScript {
  lines: DialogLine[]
  choices?: string[]
  onClose?: (choice: number) => void
}
export interface BriefData {
  title: string
  subtitle?: string
  icon?: string
  goal: string
  how: string[]
  concept?: string // concepto de System Design (texto con [[términos]])
  button?: string
  onClose?: () => void
}
export interface ResultData {
  puzzle: PuzzleId | 'boss'
  stars: number
  title: string
  lesson: string
  onClose?: () => void
}

export interface QuestEvents {
  dialog: DialogScript
  brief: BriefData
  result: ResultData
  prompt: string | null // pista de interacción ("E: hablar")
  region: string // nombre de la región al entrar
  toast: { text: string; icon?: string }
  scene: 'world' | 'puzzle' | 'title'
  objective: void // pide recalcular el objetivo
}

type Handler<T> = (payload: T) => void

class Bus {
  private handlers = new Map<keyof QuestEvents, Set<Handler<never>>>()
  on<K extends keyof QuestEvents>(event: K, fn: Handler<QuestEvents[K]>) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(fn as Handler<never>)
    return () => this.handlers.get(event)?.delete(fn as Handler<never>)
  }
  emit<K extends keyof QuestEvents>(event: K, payload: QuestEvents[K]) {
    this.handlers.get(event)?.forEach((fn) => (fn as Handler<QuestEvents[K]>)(payload))
  }
}

export const bus = new Bus()

/** Estado compartido de UI que el juego consulta en cada frame. */
export const ui = {
  blocking: false, // hay un diálogo/briefing/modal abierto: el jugador no se mueve
  releasedAt: 0, // momento en que se cerró el último modal (evita reinteractuar con la misma tecla)
}

/** Entrada virtual (cruceta táctil). */
export const touch = { up: false, down: false, left: false, right: false, action: false }

export function setBlocking(b: boolean) {
  ui.blocking = b
  if (!b) ui.releasedAt = performance.now()
}
