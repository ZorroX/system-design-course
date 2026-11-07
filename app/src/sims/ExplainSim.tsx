import { useEffect, useState } from 'react'
import { ChallengeBanner } from '@/components/ui'
import type { SimProps } from './index'

interface IndexOption {
  label: string
  plan: string
  rows: number
  ms: number
  best?: boolean
  note: string
}
interface QueryCase {
  title: string
  sql: string
  options: IndexOption[]
}

const N = '48.000.000'

const QUERIES: QueryCase[] = [
  {
    title: 'Pagos recientes de un comercio',
    sql: "SELECT * FROM payments\nWHERE merchant_id = 'm_8812' AND status = 'CAPTURED'\nORDER BY created_at DESC LIMIT 50;",
    options: [
      { label: 'Sin índice', plan: `Limit\n  -> Sort (created_at DESC)\n    -> Seq Scan on payments\n         Rows Removed by Filter: ${N}`, rows: 48_000_000, ms: 8391, note: 'Lee la tabla entera.' },
      { label: '(status)', plan: 'Limit\n  -> Sort\n    -> Bitmap Heap Scan on payments\n         -> Bitmap Index Scan on idx_status (status = CAPTURED)', rows: 33_600_000, ms: 6120, note: 'El 70% de las filas son CAPTURED: el índice casi no filtra.' },
      { label: '(merchant_id)', plan: 'Limit\n  -> Sort (created_at DESC)\n    -> Index Scan using idx_merchant\n         Filter: status = CAPTURED', rows: 6_100, ms: 21, note: 'Filtra bien, pero aún ordena 6.100 filas en memoria.' },
      { label: '(merchant_id, status, created_at DESC)', plan: 'Limit\n  -> Index Scan using idx_m_s_c (merchant_id = …, status = …)', rows: 50, ms: 0.4, best: true, note: 'Igualdades primero y la columna de orden al final: lee solo 50 entradas, ya ordenadas.' },
    ],
  },
  {
    title: 'Login por email',
    sql: "SELECT id, password_hash FROM users\nWHERE lower(email) = 'ana@mail.com';",
    options: [
      { label: '(email)', plan: 'Seq Scan on users\n  Filter: lower(email) = …', rows: 2_000_000, ms: 410, note: 'La función lower() sobre la columna impide usar el índice normal.' },
      { label: 'Índice de expresión ON users (lower(email))', plan: 'Index Scan using idx_lower_email', rows: 1, ms: 0.1, best: true, note: 'El índice guarda lower(email): coincide con la expresión de la consulta. (O guarda el email ya normalizado.)' },
      { label: '(id, email)', plan: 'Seq Scan on users', rows: 2_000_000, ms: 405, note: 'Prefijo izquierdo: sin filtrar por id, el índice no sirve.' },
    ],
  },
  {
    title: 'Job de pagos pendientes',
    sql: "SELECT id FROM payments\nWHERE status = 'PENDING' AND created_at < now() - interval '15 min';",
    options: [
      { label: '(created_at)', plan: 'Index Scan using idx_created\n  Filter: status = PENDING\n  Rows Removed by Filter: 47.900.000', rows: 47_900_000, ms: 7300, note: 'Casi todas las filas son antiguas: el rango no filtra nada.' },
      { label: '(status, created_at)', plan: 'Index Scan using idx_status_created', rows: 240, ms: 0.8, note: 'Funciona: igualdad (PENDING es el 0,5%) y luego rango.' },
      { label: "Índice parcial (created_at) WHERE status = 'PENDING'", plan: 'Index Scan using idx_pending_partial', rows: 240, ms: 0.3, best: true, note: 'Solo indexa los pendientes: diminuto, rápido y barato de mantener en escrituras.' },
    ],
  },
  {
    title: 'Pagos de un día',
    sql: "SELECT count(*) FROM payments\nWHERE DATE(created_at) = '2026-11-01';",
    options: [
      { label: '(created_at), consulta igual', plan: `Seq Scan on payments\n  Filter: date(created_at) = …\n  Rows Removed by Filter: ${N}`, rows: 48_000_000, ms: 6900, note: 'DATE() sobre la columna rompe el índice.' },
      { label: '(created_at) + reescribir como rango', plan: "Index Only Scan using idx_created\n  Index Cond: created_at >= '2026-11-01' AND created_at < '2026-11-02'", rows: 130_000, ms: 35, best: true, note: 'Rango semiabierto sobre la columna "desnuda": el índice se usa (y cubre el count).' },
      { label: 'Caché en Redis del conteo', plan: 'Seq Scan… una vez por día (y datos viejos)', rows: 48_000_000, ms: 6900, note: 'Sobreingeniería: el problema se resuelve reescribiendo la consulta (KISS).' },
    ],
  },
]

type Strategy = 'none' | 'optimistic' | 'pessimistic' | 'atomic'
const STRATS: { id: Strategy; label: string; code: string; result: string; ok: boolean }[] = [
  { id: 'none', label: 'Leer, restar en Java, escribir', code: 'SELECT balance → balance - 30 → UPDATE … SET balance = 70', result: 'Ambos cajeros leen 100 y escriben 70 y 50: el último gana. Se pierde un retiro (lost update): saldo 50 en vez de 20.', ok: false },
  { id: 'optimistic', label: 'Optimista con versión', code: 'UPDATE … SET balance = 70, version = 8 WHERE id = 1 AND version = 7', result: 'El segundo UPDATE afecta 0 filas (la versión cambió): relee 70, resta 50 y escribe 20. ✔', ok: true },
  { id: 'pessimistic', label: 'Pesimista: SELECT … FOR UPDATE', code: 'BEGIN; SELECT … FOR UPDATE; UPDATE …; COMMIT', result: 'El segundo cajero espera a que el primero haga commit y lee 70: saldo 20. ✔ (bloquea, cuidado con el orden de bloqueos)', ok: true },
  { id: 'atomic', label: 'UPDATE atómico condicional', code: 'UPDATE accounts SET balance = balance - 30 WHERE id = 1 AND balance >= 30', result: 'La base resta de forma atómica: 100 → 70 → 20. ✔ Lo más simple para un descuento.', ok: true },
]

export default function ExplainSim({ done, onComplete }: SimProps) {
  const [picked, setPicked] = useState<(number | null)[]>(QUERIES.map(() => null))
  const [q, setQ] = useState(0)
  const [strat, setStrat] = useState<Strategy | null>(null)
  const [fixed, setFixed] = useState(false)
  const bestAll = QUERIES.every((qc, i) => picked[i] !== null && qc.options[picked[i]!].best)

  useEffect(() => {
    if (!done && bestAll && fixed) onComplete()
  }, [bestAll, fixed, done, onComplete])

  const qc = QUERIES[q]
  const opt = picked[q] !== null ? qc.options[picked[q]!] : null
  const s = STRATS.find((x) => x.id === strat)

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Afinador de consultas" done={done}>
        (1) Elige el mejor índice en las 4 consultas {QUERIES.map((c, i) => (picked[i] !== null && c.options[picked[i]!].best ? '✅' : '⬜')).join('')} · (2) Evita el lost update de los dos cajeros {fixed ? '✅' : '⬜'}
      </ChallengeBanner>
      <div className="flex flex-wrap gap-2">
        {QUERIES.map((c, i) => (
          <button key={i} onClick={() => setQ(i)} className={`chip ${i === q ? '!border-accent !text-accent' : ''}`}>
            {i + 1}. {c.title} {picked[i] !== null && c.options[picked[i]!].best && '✓'}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 grid gap-3 content-start">
          <pre className="rounded-lg bg-surface-2 p-3 text-xs font-mono whitespace-pre-wrap">{qc.sql}</pre>
          <div className="text-sm font-semibold">¿Qué índice creas?</div>
          {qc.options.map((o, i) => (
            <button key={i} onClick={() => setPicked((p) => p.map((v, k) => (k === q ? i : v)))} className={`text-left text-sm rounded-lg border px-3 py-2 font-mono ${picked[q] === i ? (o.best ? 'border-good bg-good/10' : 'border-warn bg-warn/10') : 'border-border hover:border-accent'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="card p-4 grid gap-3 content-start">
          <div className="text-sm font-semibold">EXPLAIN ANALYZE</div>
          <pre className="rounded-lg bg-[#05070f] text-[#a7f3d0] p-3 text-xs font-mono whitespace-pre-wrap min-h-[7rem]">{opt ? opt.plan : '— elige un índice —'}</pre>
          {opt && (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-surface-2 p-2">Filas leídas<div className="font-bold tabular-nums">{opt.rows.toLocaleString('es')}</div></div>
                <div className="rounded-lg bg-surface-2 p-2">Tiempo<div className={`font-bold tabular-nums ${opt.ms < 5 ? 'text-good' : opt.ms < 100 ? 'text-warn' : 'text-bad'}`}>{opt.ms} ms</div></div>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className={`h-full ${opt.ms < 5 ? 'bg-good' : opt.ms < 100 ? 'bg-warn' : 'bg-bad'}`} style={{ width: `${Math.max(2, Math.min(100, (Math.log10(opt.ms + 1) / Math.log10(10000)) * 100))}%` }} />
              </div>
              <div className="text-sm text-muted">{opt.best ? '✅ ' : '💡 '}{opt.note}</div>
            </>
          )}
        </div>
      </div>
      <div className="card p-4 grid gap-3">
        <div className="font-bold">Dos cajeros, una cuenta con $100: uno retira $30 y otro $50 al mismo tiempo</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {STRATS.map((x) => (
            <button key={x.id} onClick={() => { setStrat(x.id); if (x.ok) setFixed(true) }} className={`text-left text-sm rounded-lg border px-3 py-2 ${strat === x.id ? (x.ok ? 'border-good bg-good/10' : 'border-bad bg-bad/10') : 'border-border hover:border-accent'}`}>
              <div className="font-semibold">{x.label}</div>
              <div className="text-[11px] font-mono text-muted mt-1">{x.code}</div>
            </button>
          ))}
        </div>
        {s && <div className={`text-sm rounded-lg px-3 py-2 ${s.ok ? 'bg-good/10' : 'bg-bad/10'}`}>{s.result}</div>}
      </div>
    </div>
  )
}
