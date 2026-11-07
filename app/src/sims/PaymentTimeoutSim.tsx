import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Play } from 'lucide-react'
import { ChallengeBanner, Stat } from '@/components/ui'
import { makeRng } from '@/quest/models/rng'
import type { SimProps } from './index'

type Guard = 'key' | 'hash' | 'sameRef' | 'pending' | 'recon'
const GUARDS: { id: Guard; label: string; desc: string }[] = [
  { id: 'key', label: 'Idempotency-Key', desc: 'Guardar la clave con UNIQUE y devolver la respuesta guardada en los reintentos' },
  { id: 'hash', label: 'Hash del payload', desc: 'Si la clave llega con otro cuerpo → 422 en vez de devolver la respuesta de otra operación' },
  { id: 'sameRef', label: 'Misma referencia al adquirente', desc: 'Los reintentos hacia el banco usan la misma referencia: él deduplica' },
  { id: 'pending', label: 'Timeout → PENDIENTE', desc: 'Un timeout deja el pago PENDIENTE y se consulta el estado (no se marca FALLIDO)' },
  { id: 'recon', label: 'Conciliación diaria', desc: 'Comparar con el archivo de liquidación del adquirente para cerrar los pendientes' },
]

type Event = 'ok' | 'double-click' | 'response-lost' | 'request-lost' | 'key-reuse'
type Outcome = 'ok' | 'double' | 'lost' | 'stuck'
const EVENT_LABEL: Record<Event, string> = {
  ok: 'Sin incidentes',
  'double-click': 'Doble clic (2 peticiones a la vez)',
  'response-lost': 'El banco cobró pero la respuesta se perdió',
  'request-lost': 'La petición nunca llegó al banco',
  'key-reuse': 'Bug: clave reutilizada con otro monto',
}

/** Escenario fijo de 30 pagos (mismo para todas las configuraciones). */
function scenario(): { ev: Event; queryFails: boolean }[] {
  const r = makeRng(2026)
  return Array.from({ length: 30 }, () => {
    const u = r()
    const ev: Event = u < 0.15 ? 'double-click' : u < 0.37 ? 'response-lost' : u < 0.47 ? 'request-lost' : u < 0.55 ? 'key-reuse' : 'ok'
    return { ev, queryFails: r() < 0.35 }
  })
}

function outcome(ev: Event, queryFails: boolean, g: Record<Guard, boolean>): { o: Outcome; why: string } {
  switch (ev) {
    case 'ok':
      return { o: 'ok', why: 'Cobro normal.' }
    case 'double-click':
      return g.key ? { o: 'ok', why: 'La segunda petición choca con la UNIQUE: 409 / respuesta guardada.' } : { o: 'double', why: 'Sin clave de idempotencia, ambas peticiones cobran.' }
    case 'key-reuse':
      if (!g.key) return { o: 'ok', why: 'Sin idempotencia, se cobra como un pago nuevo (correcto por casualidad).' }
      return g.hash ? { o: 'ok', why: 'El hash no coincide: 422, la app corrige y reintenta con clave nueva.' } : { o: 'lost', why: 'Se devolvió la respuesta de OTRO pago: el cliente cree que pagó y el comercio nunca cobra.' }
    case 'response-lost':
    case 'request-lost': {
      const charged = ev === 'response-lost'
      if (!g.pending) return charged ? { o: 'double', why: 'Se marcó FALLIDO, el cliente pagó de nuevo… y el primer cobro sí había pasado.' } : { o: 'ok', why: 'Se marcó FALLIDO y el cliente reintentó: esta vez no había cobro previo.' }
      if (!g.sameRef) return charged ? { o: 'double', why: 'Quedó PENDIENTE, pero el reintento usó otra referencia: el banco cobró dos veces.' } : { o: 'ok', why: 'Reintento con otra referencia; como no había cobro previo, no duplica.' }
      if (!queryFails) return { o: 'ok', why: 'PENDIENTE → consulta / reintento con la misma referencia → estado real resuelto.' }
      return g.recon ? { o: 'ok', why: 'La consulta falló, pero la conciliación del día cerró el pendiente.' } : { o: 'stuck', why: 'La consulta falló y nadie concilia: el pago quedó PENDIENTE para siempre.' }
    }
  }
}

const COLORS: Record<Outcome, string> = { ok: 'bg-good/80', double: 'bg-bad', lost: 'bg-warn', stuck: 'bg-violet' }

export default function PaymentTimeoutSim({ done, onComplete }: SimProps) {
  const sc = useMemo(scenario, [])
  const [g, setG] = useState<Record<Guard, boolean>>({ key: false, hash: false, sameRef: false, pending: false, recon: false })
  const [result, setResult] = useState<{ o: Outcome; why: string }[] | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [goals, setGoals] = useState({ broken: false, perfect: false })

  const run = () => {
    const r = sc.map((s) => outcome(s.ev, s.queryFails, g))
    setResult(r)
    setSel(null)
    const bad = r.filter((x) => x.o !== 'ok').length
    setGoals((gl) => ({ broken: gl.broken || r.some((x) => x.o === 'double'), perfect: gl.perfect || bad === 0 }))
  }

  useEffect(() => {
    if (!done && goals.broken && goals.perfect) onComplete()
  }, [goals, done, onComplete])

  const count = (o: Outcome) => result?.filter((x) => x.o === o).length ?? 0

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="El último milisegundo" done={done}>
        (1) Observa un <b>doble cargo</b> {goals.broken ? '✅' : '⬜'} · (2) Procesa los 30 pagos con <b>0 dobles cargos, 0 pagos perdidos y 0 pendientes</b> {goals.perfect ? '✅' : '⬜'}
      </ChallengeBanner>
      <div className="grid lg:grid-cols-[20rem_1fr] gap-4">
        <div className="card p-4 grid gap-2 content-start">
          <div className="font-bold text-sm">Protecciones</div>
          {GUARDS.map((x) => (
            <label key={x.id} className={`rounded-lg border p-2.5 cursor-pointer text-sm ${g[x.id] ? 'border-good/60 bg-good/10' : 'border-border'}`}>
              <div className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={g[x.id]} onChange={(e) => setG((s) => ({ ...s, [x.id]: e.target.checked }))} />
                {x.label}
              </div>
              <div className="text-xs text-muted mt-0.5">{x.desc}</div>
            </label>
          ))}
          <button className="btn btn-primary mt-1" onClick={run}><Play size={16} /> Procesar 30 pagos</button>
        </div>
        <div className="card p-4 grid gap-3 content-start">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Correctos" value={result ? count('ok') : '—'} color="var(--good)" />
            <Stat label="Dobles cargos" value={result ? count('double') : '—'} color="var(--bad)" />
            <Stat label="Pagos perdidos" value={result ? count('lost') : '—'} color="var(--warn)" />
            <Stat label="Pendientes eternos" value={result ? count('stuck') : '—'} color="var(--violet)" />
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {sc.map((s, i) => (
              <motion.button key={`${i}-${result ? 'r' : 'n'}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.02 }} onClick={() => setSel(i)} className={`h-9 rounded-md text-[10px] font-bold text-[#04131a] ${result ? COLORS[result[i].o] : 'bg-surface-2 text-muted'} ${sel === i ? 'ring-2 ring-accent' : ''}`} title={EVENT_LABEL[s.ev]}>
                #{i + 1}
              </motion.button>
            ))}
          </div>
          <div className="text-xs text-muted">🟩 correcto · 🟥 doble cargo · 🟨 pago perdido · 🟪 pendiente sin resolver. Toca un pago para ver qué pasó.</div>
          {sel !== null && (
            <div className="rounded-lg bg-surface-2 p-3 text-sm">
              <b>Pago #{sel + 1}:</b> {EVENT_LABEL[sc[sel].ev]}{(sc[sel].ev === 'response-lost' || sc[sel].ev === 'request-lost') && sc[sel].queryFails ? ' (y la consulta de estado también falla)' : ''}.
              {result && <div className="mt-1">{result[sel].why}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
