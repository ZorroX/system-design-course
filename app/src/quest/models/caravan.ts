/**
 * La Ruta de las Caravanas — Saga orquestada con compensaciones y pivote (nivel 1)
 * y participante TCC con cancelación vacía, anti-suspensión e idempotencia (nivel 2).
 */

export interface SagaStep {
  town: string
  icon: string
  action: string
  /** compensación correcta si el paso ya se completó */
  comp: string
}

export const SAGA_STEPS: SagaStep[] = [
  { town: 'Billetera', icon: '👛', action: 'Reservar $80 del saldo', comp: 'Liberar la reserva' },
  { town: 'Antifraude', icon: '🕵️', action: 'Evaluar el riesgo', comp: 'Nada: solo leyó datos' },
  { town: 'Adquirente', icon: '🏦', action: 'Cobrar la tarjeta', comp: 'Reembolsar el cobro' },
  { town: 'Comercio', icon: '🏪', action: 'Acreditar al comercio', comp: 'Revertir el abono' },
]

export const COMP_OPTIONS = ['Liberar la reserva', 'Nada: solo leyó datos', 'Reembolsar el cobro', 'Revertir el abono', 'Borrar la fila de la base de datos']

export interface SagaRound {
  failAt: number // índice del paso que falla
  failText: string
  /** si es true, el fallo es transitorio después del pivote: lo correcto es reintentar hacia adelante */
  forward?: boolean
}

export const SAGA_ROUNDS: SagaRound[] = [
  { failAt: 1, failText: 'Antifraude rechaza la operación: riesgo alto.' },
  { failAt: 2, failText: 'El adquirente rechaza la tarjeta: fondos insuficientes.' },
  { failAt: 3, failText: 'El servicio del comercio no responde (timeout). El cobro con tarjeta YA se hizo.', forward: true },
]

export const FORWARD_OPTIONS = [
  { label: 'Reintentar el abono con backoff (es idempotente)', correct: true },
  { label: 'Abandonar la saga y avisar a soporte', correct: false },
  { label: 'Compensar todo: reembolsar y liberar', correct: false },
]

export const FORWARD_WHY =
  'Cobrar la tarjeta es el **pivote** de la saga: una vez hecho, los pasos siguientes deben ser **reintentables** (idempotentes) y se recupera hacia adelante. Reembolsar por un timeout transitorio del comercio frustra una venta válida y cuesta comisiones.'

/** Compensaciones esperadas (en orden inverso) para una ronda */
export function expectedComps(round: SagaRound): string[] {
  const out: string[] = []
  for (let i = round.failAt - 1; i >= 0; i--) out.push(SAGA_STEPS[i].comp)
  return out
}

export function sagaStars(errors: number) {
  return errors === 0 ? 3 : errors === 1 ? 2 : errors === 2 ? 1 : 0
}

/* ---------------- Nivel 2: participante TCC ---------------- */
export type TccOp = 'try' | 'confirm' | 'cancel'
export type TccAction = 'freeze' | 'confirm' | 'release' | 'empty' | 'ignore'

export const TCC_ACTIONS: { id: TccAction; label: string }[] = [
  { id: 'freeze', label: '🧊 Congelar fondos' },
  { id: 'confirm', label: '✅ Descontar lo congelado' },
  { id: 'release', label: '🔓 Liberar lo congelado' },
  { id: 'empty', label: '📝 Cancelación vacía' },
  { id: 'ignore', label: '🚫 Rechazar / ignorar' },
]

export interface TccMsg {
  op: TccOp
  tx: string
  amount: number
  note?: string
}

export const TCC_START_BALANCE = 500

export const TCC_MSGS: TccMsg[] = [
  { op: 'try', tx: 'T1', amount: 100 },
  { op: 'confirm', tx: 'T1', amount: 100 },
  { op: 'confirm', tx: 'T1', amount: 100, note: 'El coordinador no recibió tu respuesta y reenvía.' },
  { op: 'cancel', tx: 'T2', amount: 70, note: 'El Try de T2 se retrasó en la red y el coordinador ya decidió cancelar.' },
  { op: 'try', tx: 'T2', amount: 70, note: 'Por fin llega el Try retrasado de T2.' },
  { op: 'try', tx: 'T3', amount: 600 },
  { op: 'try', tx: 'T4', amount: 150 },
  { op: 'cancel', tx: 'T4', amount: 150 },
  { op: 'cancel', tx: 'T4', amount: 150, note: 'Reenvío del Cancel.' },
]

export type TxState = 'tried' | 'confirmed' | 'cancelled' | 'empty'

export interface Wallet {
  available: number
  frozen: number
  txs: Record<string, TxState>
}

export function tccCorrect(w: Wallet, m: TccMsg): TccAction {
  const st = w.txs[m.tx]
  if (m.op === 'try') {
    if (st) return 'ignore' // duplicado, o llegó después de un Cancel (anti-suspensión)
    if (w.available < m.amount) return 'ignore'
    return 'freeze'
  }
  if (m.op === 'confirm') return st === 'tried' ? 'confirm' : 'ignore'
  // cancel
  if (st === 'tried') return 'release'
  if (!st) return 'empty'
  return 'ignore'
}

/** Aplica siempre la acción CORRECTA (el estado del juego no se corrompe con los errores del jugador). */
export function tccApply(w: Wallet, m: TccMsg): Wallet {
  const a = tccCorrect(w, m)
  const n: Wallet = { available: w.available, frozen: w.frozen, txs: { ...w.txs } }
  if (a === 'freeze') {
    n.available -= m.amount
    n.frozen += m.amount
    n.txs[m.tx] = 'tried'
  } else if (a === 'confirm') {
    n.frozen -= m.amount
    n.txs[m.tx] = 'confirmed'
  } else if (a === 'release') {
    n.frozen -= m.amount
    n.available += m.amount
    n.txs[m.tx] = 'cancelled'
  } else if (a === 'empty') n.txs[m.tx] = 'empty'
  return n
}

export function tccWhy(w: Wallet, m: TccMsg): string {
  const st = w.txs[m.tx]
  const a = tccCorrect(w, m)
  if (m.op === 'try') {
    if (st === 'empty' || st === 'cancelled') return `**Anti-suspensión**: ${m.tx} ya fue cancelada. Si congelas ahora, esos fondos quedarían bloqueados para siempre (nadie enviará otro Cancel).`
    if (st) return `${m.tx} ya se procesó: el Try es idempotente, no se congela dos veces.`
    if (a === 'ignore') return `Solo hay $${w.available} disponibles: el Try falla y el coordinador cancelará la transacción global.`
    return `Try: se reservan (congelan) $${m.amount}. Aún no se descuenta nada.`
  }
  if (m.op === 'confirm') return st === 'tried' ? 'Confirm: lo congelado se descuenta definitivamente.' : `${m.tx} ya está confirmada: Confirm debe ser idempotente.`
  if (st === 'tried') return 'Cancel: se liberan los fondos congelados.'
  if (!st) return `**Cancelación vacía**: llegó Cancel sin Try previo. No hay nada que liberar, pero se registra ${m.tx} como cancelada para rechazar un Try tardío.`
  return 'Ya estaba cancelada: Cancel idempotente, no se libera dos veces.'
}

export function tccStars(errors: number) {
  return errors === 0 ? 3 : errors === 1 ? 2 : errors === 2 ? 1 : 0
}
