/**
 * La Bóveda del Tesoro — idempotency keys con hash del payload (nivel 1)
 * y decisiones ante timeouts "en el último milisegundo" (nivel 2).
 */

export type VaultAction = 'process' | 'replay' | 'conflict' | 'reject'

export const VAULT_ACTIONS: { id: VaultAction; label: string; short: string }[] = [
  { id: 'process', label: '💳 Cobrar (clave nueva)', short: 'Cobrar' },
  { id: 'replay', label: '↩️ Devolver respuesta guardada', short: 'Respuesta guardada' },
  { id: 'conflict', label: '⏳ 409: aún en curso', short: '409 en curso' },
  { id: 'reject', label: '⛔ 422: payload distinto', short: '422 payload distinto' },
]

export interface VaultRequest {
  who: string
  key: string
  amount: number
  dest: string
  note: string
}

/** Las peticiones del nivel 1, en orden. La respuesta correcta se calcula con el ledger. */
export const VAULT_L1: VaultRequest[] = [
  { who: 'Ana', key: 'K-A1', amount: 120, dest: 'Café Luna', note: 'Primer intento de pago.' },
  { who: 'Beto', key: 'K-B7', amount: 45, dest: 'Farmacia Sol', note: 'Pago nuevo.' },
  { who: 'Ana', key: 'K-A1', amount: 120, dest: 'Café Luna', note: 'La app de Ana no recibió respuesta y reintenta.' },
  { who: 'Carla', key: 'K-C3', amount: 300, dest: 'Hotel Brisa', note: 'Reserva de hotel.' },
  { who: 'Beto', key: 'K-B7', amount: 45, dest: 'Farmacia Sol', note: 'Beto pulsa "Pagar" otra vez.' },
  { who: 'Ana', key: 'K-A2', amount: 120, dest: 'Café Luna', note: 'Ana vuelve al día siguiente y compra lo mismo.' },
  { who: 'Darío', key: 'K-C3', amount: 999, dest: 'Tienda Rayo', note: 'Un bug en la app de Darío reutiliza una clave.' },
  { who: 'Carla', key: 'K-C3', amount: 300, dest: 'Hotel Brisa', note: 'El móvil de Carla reintenta tras perder señal.' },
  { who: 'Eva', key: 'K-E5', amount: 60, dest: 'Cine Nube', note: 'Pago nuevo.' },
  { who: 'Eva', key: 'K-E5', amount: 60, dest: 'Cine Nube', note: 'Doble clic de Eva: llega casi a la vez.' },
  { who: 'Eva', key: 'K-E5', amount: 65, dest: 'Cine Nube', note: 'Eva cambió el monto pero la app reutilizó la clave.' },
  { who: 'Ana', key: 'K-A1', amount: 120, dest: 'Café Luna', note: 'Reintento muy tardío de la primera petición.' },
]

/** Un cobro queda "en curso" durante las 2 peticiones siguientes (el adquirente tarda). */
export const IN_PROGRESS_CARDS = 2

/** Hash corto y estable del payload (como SHA-256 del cuerpo canónico, recortado). */
export function payloadHash(r: Pick<VaultRequest, 'amount' | 'dest'>): string {
  const s = `${r.amount}|${r.dest}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 0xffff).toString(16).toUpperCase().padStart(4, '0')
}

export interface LedgerEntry {
  key: string
  hash: string
  amount: number
  at: number // índice de la petición que lo creó
}

export function statusOf(e: LedgerEntry, idx: number): 'progress' | 'done' {
  return idx - e.at <= IN_PROGRESS_CARDS ? 'progress' : 'done'
}

export function correctAction(ledger: LedgerEntry[], r: VaultRequest, idx: number): VaultAction {
  const e = ledger.find((x) => x.key === r.key)
  if (!e) return 'process'
  if (e.hash !== payloadHash(r)) return 'reject'
  return statusOf(e, idx) === 'progress' ? 'conflict' : 'replay'
}

export function explain(action: VaultAction, r: VaultRequest): string {
  switch (action) {
    case 'process':
      return `La clave ${r.key} nunca se vio: es una operación nueva. Se guarda (clave, hash, EN_CURSO) en la misma transacción y se cobra.`
    case 'replay':
      return `Misma clave y mismo hash, y el cobro ya terminó: se devuelve la respuesta guardada sin volver a cobrar.`
    case 'conflict':
      return `Misma clave y mismo hash, pero el primer cobro sigue en curso: responde 409 y que el cliente reintente luego. Cobrar ahora sería un doble cargo.`
    case 'reject':
      return `La clave ya existe con OTRO payload (el hash no coincide): es un error del cliente. Responde 422 y no cobres nada.`
  }
}

export function vaultStars(errors: number) {
  return errors <= 1 ? 3 : errors === 2 ? 2 : errors === 3 ? 1 : 0
}

/* ---------------- Nivel 2: el último milisegundo ---------------- */
export interface VaultCase {
  title: string
  text: string
  options: string[]
  answer: number
  why: string
}

export const VAULT_L2: VaultCase[] = [
  {
    title: 'Timeout con el adquirente',
    text: 'Enviaste un cobro de $120 al banco adquirente y la conexión se cortó a los 29,9 s. No sabes si el banco cobró o no. ¿Qué haces?',
    options: ['Marcar el pago como FALLIDO y pedir al cliente que pague otra vez', 'Reintentar el cobro con una referencia NUEVA', 'Dejarlo PENDIENTE y consultar el estado al adquirente (o reintentar con la MISMA referencia)'],
    answer: 2,
    why: 'Un timeout no es un "no". El estado es DESCONOCIDO: se consulta al adquirente con la misma referencia o se reintenta con la misma clave para que él deduplique.',
  },
  {
    title: 'El adquirente no contesta',
    text: 'La consulta de estado también falla: el adquirente está caído. El cliente espera en la pantalla.',
    options: ['Mantener PENDIENTE, reintentar la consulta con backoff y conciliar con el archivo de liquidación del día', 'Reembolsar automáticamente para no dejar al cliente esperando', 'Cobrar otra vez en una hora'],
    answer: 0,
    why: 'Se muestra "procesando" al cliente, se reintenta con backoff y, como red de seguridad, la conciliación diaria contra el archivo del adquirente resuelve los pendientes.',
  },
  {
    title: 'Doble clic en dos réplicas',
    text: 'Dos réplicas de tu API reciben a la vez la misma idempotency key. ¿Cómo evitas que ambas cobren?',
    options: ['SELECT para ver si existe y, si no, INSERT', 'INSERT con restricción UNIQUE(key) en estado EN_CURSO: la segunda falla y responde 409', 'Un lock distribuido con Redis + ZooKeeper + Kafka'],
    answer: 1,
    why: 'SELECT-luego-INSERT tiene una carrera. La restricción UNIQUE de la base de datos es atómica, simple y suficiente (KISS). No hace falta infraestructura extra.',
  },
  {
    title: 'Saldo y registro',
    text: 'Al confirmar el cobro debes descontar el saldo de la billetera, registrar el movimiento y avisar a otros servicios.',
    options: ['Dos transacciones: primero el saldo, luego el movimiento, y luego publicar en Kafka', 'Una sola transacción local: asientos del ledger + saldo + fila en la tabla outbox; un relay publica después', 'Actualizar el saldo en Redis y escribir la base de datos de forma asíncrona'],
    answer: 1,
    why: 'Todo lo local en UNA transacción ACID. El evento va a la tabla outbox en esa misma transacción, así nunca hay saldo descontado sin evento ni evento sin saldo.',
  },
  {
    title: 'Webhook triplicado',
    text: 'El adquirente envía el webhook "payment.captured" tres veces para el mismo pago.',
    options: ['Procesar cada webhook: acreditar al comercio tres veces', 'Guardar el id del evento con UNIQUE (inbox) y solo transicionar si el pago está PENDIENTE', 'Ignorar los webhooks y confiar solo en la respuesta síncrona'],
    answer: 1,
    why: 'Los webhooks se entregan al menos una vez. Se deduplica por id de evento y la máquina de estados solo permite PENDIENTE → CAPTURADO una vez.',
  },
  {
    title: 'Cómo guardar el dinero',
    text: '¿Cómo modelas los saldos de los comercios?',
    options: ['Columna saldo FLOAT en dólares, leer-sumar-escribir desde Java', 'Ledger de doble partida inmutable (montos en centavos, enteros) y saldo derivado con UPDATE atómico', 'Un documento JSON por comercio con su historial'],
    answer: 1,
    why: 'Nunca FLOAT para dinero. Un ledger append-only de doble partida es auditable y cuadra siempre; el saldo se materializa con UPDATE ... SET saldo = saldo - x WHERE saldo >= x.',
  },
  {
    title: 'Caída entre la base y Kafka',
    text: 'Guardas el pago en la base de datos y luego publicas "PaymentCaptured" en Kafka. El proceso muere justo entre ambas cosas.',
    options: ['No pasa nada: Kafka es confiable', 'Patrón Transactional Outbox: el evento se guarda en la misma transacción y un relay (o CDC) lo publica', 'Publicar primero en Kafka y luego guardar en la base'],
    answer: 1,
    why: 'Es el problema de la doble escritura. Con outbox, la base es la única fuente de verdad y el evento se publica al menos una vez; el consumidor deduplica.',
  },
  {
    title: '¿Cuánto vive una clave?',
    text: '¿Durante cuánto tiempo guardas las idempotency keys?',
    options: ['Para siempre, en un HashMap estático en memoria', 'Con TTL mayor que la ventana de reintentos (p. ej. 24 h) en la base de datos o en Redis', '1 minuto'],
    answer: 1,
    why: 'Un HashMap estático sin expiración es una fuga de memoria (lo verás en la Torre del Vigía). El TTL debe cubrir la ventana en que un cliente puede reintentar.',
  },
]

export function vaultL2Stars(correct: number) {
  const n = VAULT_L2.length
  return correct === n ? 3 : correct === n - 1 ? 2 : correct === n - 2 ? 1 : 0
}
