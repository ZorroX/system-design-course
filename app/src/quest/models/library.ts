/**
 * La Biblioteca del Olvido — expulsión de caché.
 * El escritorio (caché) tiene k huecos; el archivo (base de datos) está lejos.
 */
import { makeRng } from './rng.ts'

export type Policy = 'LRU' | 'LFU' | 'FIFO' | 'RANDOM'

/** Algoritmo óptimo de Bélády: expulsa el libro que más tardará en volver a pedirse. */
export function beladyHits(seq: string[], k: number): number {
  const desk: string[] = []
  let hits = 0
  seq.forEach((b, i) => {
    if (desk.includes(b)) {
      hits++
      return
    }
    if (desk.length < k) {
      desk.push(b)
      return
    }
    const victim = bestVictim(desk, seq, i)
    desk[desk.indexOf(victim)] = b
  })
  return hits
}

/** Libro del escritorio cuyo siguiente uso está más lejos (o nunca). */
export function bestVictim(desk: string[], seq: string[], i: number): string {
  let victim = desk[0]
  let far = -1
  for (const d of desk) {
    const next = seq.indexOf(d, i + 1)
    const dist = next === -1 ? Infinity : next
    if (dist > far) {
      far = dist
      victim = d
    }
  }
  return victim
}

export function simulatePolicy(seq: string[], k: number, policy: Policy, seed = 3): { hits: number; trace: boolean[] } {
  const rnd = makeRng(seed)
  const desk: { b: string; last: number; freq: number; ins: number }[] = []
  const trace: boolean[] = []
  let hits = 0
  seq.forEach((b, t) => {
    const e = desk.find((x) => x.b === b)
    if (e) {
      hits++
      e.last = t
      e.freq++
      trace.push(true)
      return
    }
    trace.push(false)
    if (desk.length >= k) {
      let vi = 0
      if (policy === 'LRU') vi = desk.reduce((bi, x, i) => (x.last < desk[bi].last ? i : bi), 0)
      if (policy === 'LFU') vi = desk.reduce((bi, x, i) => (x.freq < desk[bi].freq || (x.freq === desk[bi].freq && x.last < desk[bi].last) ? i : bi), 0)
      if (policy === 'FIFO') vi = desk.reduce((bi, x, i) => (x.ins < desk[bi].ins ? i : bi), 0)
      if (policy === 'RANDOM') vi = Math.floor(rnd() * desk.length)
      desk.splice(vi, 1)
    }
    desk.push({ b, last: t, freq: 1, ins: t })
  })
  return { hits, trace }
}

/** Nivel 1: secuencia visible (puzle de planificación). */
export const LIB_L1 = { k: 3, seq: 'A B C A D A B E A B C D B A'.split(' ') }

/**
 * Nivel 2: futuro desconocido. Dos libros muy populares (A, B) y, de vez en cuando,
 * el "inventario anual": una ráfaga de libros que se piden UNA sola vez (un escaneo).
 * LRU y FIFO tiran los populares durante el escaneo; LFU los protege por frecuencia.
 */
export function libL2Sequence(): string[] {
  return 'A B A B C A B A D E F A B A B G H I A B C A B A J K L A B A B'.split(' ')
}
export const LIB_L2_K = 3
export const LIB_L2_TARGET = 16
