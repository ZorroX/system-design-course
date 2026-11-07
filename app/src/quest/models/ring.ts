/**
 * El Anillo de los Custodios — consistent hashing.
 * 24 posiciones en el anillo; los orbes (claves) están entre posiciones.
 * Un orbe pertenece al primer custodio en sentido horario.
 */
export const SLOTS = 24
export const ORBS = [0.5, 1.5, 3.5, 4.5, 5.5, 8.5, 11.5, 12.5, 13.5, 17.5, 20.5, 22.5]

export interface Token {
  slot: number
  owner: number // índice del custodio
  locked?: boolean
}

export function ownerOf(tokens: Token[], orb: number): number {
  if (!tokens.length) return -1
  const sorted = [...tokens].sort((a, b) => a.slot - b.slot)
  const t = sorted.find((x) => x.slot >= orb) ?? sorted[0]
  return t.owner
}

export function loads(tokens: Token[], custodians: number): number[] {
  const l = Array(custodians).fill(0)
  for (const o of ORBS) {
    const w = ownerOf(tokens, o)
    if (w >= 0) l[w]++
  }
  return l
}

/** Si cae el custodio c, ¿a cuántos custodios distintos van sus orbes? */
export function heirsIfRemoved(tokens: Token[], c: number): Set<number> {
  const rest = tokens.filter((t) => t.owner !== c)
  const heirs = new Set<number>()
  for (const o of ORBS) if (ownerOf(tokens, o) === c) heirs.add(ownerOf(rest, o))
  return heirs
}

export interface RingLevel {
  title: string
  custodians: number
  tokensPerCustodian: number
  locked: Token[]
  check: (tokens: Token[]) => { ok: boolean; stars: number; msg: string }
}

const L2_LOCKED: Token[] = [
  { slot: 5, owner: 0, locked: true },
  { slot: 13, owner: 1, locked: true },
  { slot: 17, owner: 2, locked: true },
]

export const RING_LEVELS: RingLevel[] = [
  {
    title: 'Reparto justo',
    custodians: 3,
    tokensPerCustodian: 1,
    locked: [],
    check: (tokens) => {
      const l = loads(tokens, 3)
      const placed = tokens.length === 3
      const ok = placed && l.every((x) => x === 4)
      return { ok, stars: ok ? 3 : 0, msg: !placed ? 'Coloca a los 3 custodios.' : ok ? '¡Cada custodio guarda 4 orbes!' : `Cargas: ${l.join(' / ')}. Deben ser 4 / 4 / 4.` }
    },
  },
  {
    title: 'Llega un custodio nuevo',
    custodians: 4,
    tokensPerCustodian: 1,
    locked: L2_LOCKED,
    check: (tokens) => {
      const before = L2_LOCKED.map((t) => t)
      const added = tokens.filter((t) => !t.locked)
      if (added.length !== 1) return { ok: false, stars: 0, msg: 'Coloca al custodio amarillo (solo uno).' }
      const l = loads(tokens, 4)
      const moved = ORBS.filter((o) => ownerOf(before, o) !== ownerOf(tokens, o)).length
      const ok = Math.max(...l) <= 4
      return {
        ok,
        stars: ok ? (moved <= 3 ? 3 : 2) : 0,
        msg: ok ? `Nadie guarda más de 4 y solo se movieron ${moved} orbes (con hash % N se habrían movido casi todos).` : `Cargas: ${l.join(' / ')}. Nadie debe guardar más de 4.`,
      }
    },
  },
  {
    title: 'Nodos virtuales',
    custodians: 3,
    tokensPerCustodian: 2,
    locked: [],
    check: (tokens) => {
      if (tokens.length !== 6) return { ok: false, stars: 0, msg: 'Cada custodio debe colocar sus 2 marcas (6 en total).' }
      const l = loads(tokens, 3)
      const balanced = l.every((x) => x === 4)
      const spread = [0, 1, 2].every((c) => heirsIfRemoved(tokens, c).size >= 2)
      const ok = balanced && spread
      return {
        ok,
        stars: ok ? 3 : 0,
        msg: ok
          ? '¡Equilibrio perfecto! Y si cae cualquier custodio, su carga se reparte entre los otros dos.'
          : !balanced
            ? `Cargas: ${l.join(' / ')}. Deben ser 4 / 4 / 4.`
            : 'Equilibrado, pero si cae algún custodio TODA su carga iría a uno solo. Intercala mejor las marcas.',
      }
    },
  },
]
