/**
 * El Puente Partido — CAP (decisiones durante una partición) y la Cerradura del Quórum (R + W > N).
 */
export interface CapCard {
  side: 'norte' | 'sur'
  who: string
  ask: string
  correct: 'atender' | 'rechazar'
  why: string
}

/** Norte tiene 2 de 3 escribas (mayoría); el Sur tiene 1 (minoría). */
export const CAP_CARDS: CapCard[] = [
  { side: 'sur', who: 'Mercader del Sur', ask: 'Quiero retirar 100 monedas de mi cuenta.', correct: 'rechazar', why: 'El Sur es minoría: no puede saber si en el Norte ya se gastó ese dinero. Dinero = consistencia fuerte. Mejor esperar al puente.' },
  { side: 'norte', who: 'Panadera del Norte', ask: 'Quiero depositar 50 monedas.', correct: 'atender', why: 'El Norte tiene 2 de 3 escribas: tiene quórum. Puede escribir sin riesgo de contradecirse.' },
  { side: 'sur', who: 'Niño del Sur', ask: '¿Cuántos "me gusta" tiene mi dibujo en el tablón?', correct: 'atender', why: 'Un dato viejo de unos minutos no hace daño. Aquí conviene la disponibilidad (consistencia eventual).' },
  { side: 'sur', who: 'Viajera', ask: 'Resérvame la ÚLTIMA habitación de la posada.', correct: 'rechazar', why: 'Inventario escaso: si el Norte también la vende, habría dos dueños. Sin mayoría, se rechaza.' },
  { side: 'sur', who: 'Turista', ask: 'Muéstrame el menú del día.', correct: 'atender', why: 'Lectura sin consecuencias graves: mejor responder con lo que tengamos (AP).' },
  { side: 'norte', who: 'Herrero del Norte', ask: 'Transfiere 30 monedas a mi primo del Norte.', correct: 'atender', why: 'El Norte tiene quórum: la transferencia es segura aunque el Sur esté aislado.' },
]

export function capStars(correct: number) {
  return correct >= 6 ? 3 : correct === 5 ? 2 : 0
}

export const QUORUM_N = 5

export interface QuorumResult {
  stale: number
  trials: number
  tolerates: boolean
  cost: number
  ok: boolean
  stars: number
  msg: string
}

/** Evalúa R y W: lecturas viejas, tolerancia a un escriba enfermo y costo. */
export function evaluateQuorum(r: number, w: number, rnd: () => number, trials = 40): QuorumResult {
  const N = QUORUM_N
  let stale = 0
  for (let i = 0; i < trials; i++) {
    const keepers = Array.from({ length: N }, (_, k) => k)
    const pick = (n: number) => [...keepers].sort(() => rnd() - 0.5).slice(0, n)
    const wrote = new Set(pick(w))
    const read = pick(r)
    if (!read.some((k) => wrote.has(k))) stale++
  }
  const tolerates = r <= N - 1 && w <= N - 1
  const cost = r + w
  const strong = r + w > N
  const ok = strong && tolerates
  const stars = ok ? (cost === N + 1 ? 3 : 2) : 0
  const msg = !strong
    ? `R + W = ${cost} ≤ ${N}: a veces lees de escribas que no recibieron la escritura (${stale}/${trials} lecturas viejas).`
    : !tolerates
      ? `Nunca lees datos viejos, pero si un escriba enferma no puedes ${w > N - 1 ? 'escribir' : 'leer'}: necesitas a los ${N}.`
      : cost === N + 1
        ? `¡Perfecto! R + W = ${cost} > ${N}: toda lectura toca al menos un escriba actualizado, y aguantas que uno enferme.`
        : `Funciona, pero R + W = ${cost}: consultas más escribas de los necesarios (más lento). Prueba con R + W = ${N + 1}.`
  return { stale, trials, tolerates, cost, ok, stars, msg }
}
