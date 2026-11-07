import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Segmented, Slider } from './ui'
import { fmt } from '@/lib/format'
import type { WidgetId } from '@/data/types'
import { Term } from './Term'

function Frame({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="my-5 rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/5 to-transparent p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-accent mb-3 flex items-center gap-2">
        <span>{icon}</span> Interactivo · {title}
      </div>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
const LATENCIES: { op: string; ns: number }[] = [
  { op: 'Referencia a [[cpu-cache|caché L1]]', ns: 1 },
  { op: '[[branch-mispredict|Branch mispredict]]', ns: 3 },
  { op: 'Referencia a [[cpu-cache|caché L2]]', ns: 4 },
  { op: 'Lock/unlock de [[mutex|mutex]]', ns: 17 },
  { op: 'Referencia a [[ram|memoria RAM]]', ns: 100 },
  { op: 'Comprimir 1 KB ([[compression|Snappy]])', ns: 2_000 },
  { op: 'Leer 4 KB aleatorio de [[ssd|SSD]]', ns: 16_000 },
  { op: '[[rtt|Round trip]] en el mismo [[datacenter|datacenter]]', ns: 500_000 },
  { op: 'Leer 1 MB secuencial de SSD', ns: 1_000_000 },
  { op: '[[hdd|Seek de disco HDD]]', ns: 2_000_000 },
  { op: 'Leer 1 MB secuencial de HDD', ns: 5_000_000 },
  { op: '[[rtt|Round trip]] California → Países Bajos', ns: 150_000_000 },
]

/** Renderiza texto con marcas [[id|label]] como términos con tooltip. */
function TermText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[\[[^\]]+\]\])/g).map((p, i) => {
        if (!p.startsWith('[[')) return <span key={i}>{p}</span>
        const [id, label] = p.slice(2, -2).split('|')
        return <Term key={i} id={id}>{label}</Term>
      })}
    </>
  )
}

function human(ns: number, scaled: boolean): string {
  if (scaled) {
    // 1 ns => 1 s
    const s = ns
    if (s < 60) return `${s} s`
    if (s < 3600) return `${(s / 60).toFixed(1)} min`
    if (s < 86400) return `${(s / 3600).toFixed(1)} h`
    if (s < 86400 * 365) return `${(s / 86400).toFixed(1)} días`
    return `${(s / (86400 * 365)).toFixed(1)} años`
  }
  if (ns < 1000) return `${ns} ns`
  if (ns < 1e6) return `${ns / 1000} µs`
  return `${ns / 1e6} ms`
}

function LatencyNumbers() {
  const [scaled, setScaled] = useState(false)
  const max = Math.log10(LATENCIES[LATENCIES.length - 1].ns) + 0.3
  return (
    <Frame title="Latencias que todo ingeniero debe conocer" icon="⏱️">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          size="sm"
          value={scaled ? 'h' : 'r'}
          onChange={(v) => setScaled(v === 'h')}
          options={[
            { id: 'r', label: 'Tiempo real' },
            { id: 'h', label: 'Escala humana (1 ns = 1 s)' },
          ]}
        />
      </div>
      <div className="grid gap-1.5">
        {LATENCIES.map((l, i) => (
          <div key={l.op} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,15rem)_1fr_6.5rem] items-center gap-x-3 gap-y-1 text-xs">
            <span className="truncate text-muted">
              <TermText text={l.op} />
            </span>
            <span className="sm:order-last text-right font-mono font-semibold tabular-nums">{human(l.ns, scaled)}</span>
            <div className="col-span-2 sm:col-span-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `hsl(${190 - i * 15} 85% 60%)` }}
                initial={{ width: 0 }}
                whileInView={{ width: `${(Math.max(0.3, Math.log10(l.ns) + 0.3) / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.6 }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-3">
        Escala logarítmica. Pasa el cursor (o toca) sobre los términos subrayados para ver qué significan. {scaled ? 'Si leer de L1 tardara 1 segundo, un round trip transatlántico tardaría casi 5 años.' : 'La red y el disco son órdenes de magnitud más lentos que la memoria: por eso existen las cachés.'}
      </p>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
function ScalingCompare() {
  const [users, setUsers] = useState(50_000)
  // capacidad: 1 servidor pequeño = 10k usuarios. Vertical: tamaños x2 con precio x2.3
  const smallCap = 10_000
  const sizes = [1, 2, 4, 8, 16, 32, 64]
  const needed = users / smallCap
  const vSize = sizes.find((s) => s >= needed)
  const vCost = vSize ? Math.round(70 * Math.pow(vSize, 1.2)) : null
  const hCount = Math.max(2, Math.ceil(needed / 0.7))
  const hCost = hCount * 70 + 25
  return (
    <Frame title="Vertical vs horizontal" icon="📐">
      <Slider label="Usuarios concurrentes" min={5_000} max={1_000_000} step={5_000} value={users} onChange={setUsers} format={(v) => fmt(v)} />
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div className="rounded-xl bg-surface-2 border border-border p-3">
          <div className="font-semibold text-sm mb-2">⬆️ Vertical</div>
          <div className="h-28 flex items-end justify-center">
            {vSize ? (
              <motion.div layout className="rounded-lg bg-violet/70 border-2 border-violet flex items-center justify-center text-xs font-bold text-white" animate={{ width: 24 + Math.sqrt(vSize) * 14, height: 20 + Math.sqrt(vSize) * 10 }}>
                ×{vSize}
              </motion.div>
            ) : (
              <motion.div animate={{ x: [0, -4, 4, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, repeatDelay: 1 }} className="text-center text-bad font-bold text-sm">
                💥 No existe una máquina
                <br />
                tan grande
              </motion.div>
            )}
          </div>
          <div className="text-xs text-muted mt-2">
            {vSize ? `1 máquina ×${vSize} · ~$${fmt(vCost!)}/mes · SPOF` : 'Límite físico alcanzado: toca escalar horizontal.'}
          </div>
        </div>
        <div className="rounded-xl bg-surface-2 border border-border p-3">
          <div className="font-semibold text-sm mb-2">➡️ Horizontal</div>
          <div className="h-28 flex flex-wrap content-end justify-center gap-1 overflow-hidden">
            <AnimatePresence>
              {Array.from({ length: Math.min(hCount, 60) }).map((_, i) => (
                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="w-4 h-4 rounded bg-good/70 border border-good" />
              ))}
            </AnimatePresence>
          </div>
          <div className="text-xs text-muted mt-2">
            {hCount} instancias + LB · ~${fmt(hCost)}/mes · tolera fallos{hCount > 60 ? ' (mostrando 60)' : ''}
          </div>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
const NEEDS = [
  { id: 'tx', label: 'Transacciones multi-fila (dinero, inventario)' },
  { id: 'joins', label: 'Consultas ad-hoc y joins complejos' },
  { id: 'writes', label: 'Escrituras masivas (>50k/s)' },
  { id: 'schema', label: 'Esquema flexible / cambia seguido' },
  { id: 'key', label: 'Acceso casi siempre por clave' },
  { id: 'text', label: 'Búsqueda de texto completo' },
  { id: 'latency', label: 'Latencia sub-milisegundo' },
  { id: 'global', label: 'Multi-región con baja latencia global' },
] as const
type Need = (typeof NEEDS)[number]['id']
const DBS: { name: string; fit: Partial<Record<Need, number>> }[] = [
  { name: 'PostgreSQL', fit: { tx: 3, joins: 3, schema: 1, key: 1, text: 1 } },
  { name: 'DynamoDB / Cosmos DB', fit: { key: 3, writes: 2, global: 3, schema: 2, latency: 1 } },
  { name: 'Cassandra / ScyllaDB', fit: { writes: 3, key: 2, global: 2 } },
  { name: 'MongoDB', fit: { schema: 3, key: 2, tx: 1, joins: 1 } },
  { name: 'Redis', fit: { latency: 3, key: 3 } },
  { name: 'Elasticsearch / OpenSearch', fit: { text: 3, joins: 1 } },
  { name: 'Spanner / CockroachDB', fit: { tx: 3, global: 3, joins: 2 } },
]
function SqlVsNoSql() {
  const [sel, setSel] = useState<Need[]>(['tx'])
  const scores = DBS.map((d) => ({ ...d, score: sel.reduce((acc, n) => acc + (d.fit[n] ?? 0), 0) })).sort((a, b) => b.score - a.score)
  const top = scores[0].score || 1
  return (
    <Frame title="¿Qué base de datos?" icon="🧭">
      <div className="text-xs text-muted mb-2">Marca lo que necesita tu sistema:</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {NEEDS.map((n) => {
          const on = sel.includes(n.id)
          return (
            <button key={n.id} onClick={() => setSel((s) => (on ? s.filter((x) => x !== n.id) : [...s, n.id]))} className={`chip !text-xs !py-1 transition-colors ${on ? '!bg-accent !text-[#04131a] !border-accent' : ''}`}>
              {on ? '✓ ' : ''}
              {n.label}
            </button>
          )
        })}
      </div>
      <div className="grid gap-1.5">
        {scores.map((d, i) => (
          <motion.div layout key={d.name} className="grid grid-cols-[9.5rem_1fr] sm:grid-cols-[13rem_1fr] items-center gap-3 text-xs">
            <span className={`truncate ${i === 0 && d.score > 0 ? 'font-bold text-text' : 'text-muted'}`}>
              {i === 0 && d.score > 0 ? '🏆 ' : ''}
              {d.name}
            </span>
            <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
              <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${(d.score / top) * 100}%`, opacity: d.score ? 1 : 0.2 }} />
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-muted mt-3">Heurística orientativa. En la vida real muchas arquitecturas combinan varias (persistencia políglota): Postgres para pedidos, Redis para sesiones, OpenSearch para búsqueda.</p>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
const DNS_STEPS = [
  { who: 'Navegador', what: '¿Tengo app.example.com en mi caché?', ms: 0 },
  { who: 'Sistema operativo', what: 'Revisa su caché y /etc/hosts', ms: 1 },
  { who: 'Resolver recursivo (ISP / 1.1.1.1)', what: '¿Lo tengo cacheado? No: pregunto desde la raíz', ms: 10 },
  { who: 'Servidor raíz (.)', what: '"No sé app.example.com, pero .com lo gestionan estos servidores TLD"', ms: 20 },
  { who: 'Servidor TLD (.com)', what: '"example.com lo resuelven ns1.example-dns.net"', ms: 20 },
  { who: 'Servidor autoritativo', what: '"app.example.com → A 203.0.113.10, TTL 300"', ms: 25 },
  { who: 'Resolver → Navegador', what: 'Cachea la respuesta durante el TTL y la devuelve', ms: 10 },
]
function DnsResolution() {
  const [step, setStep] = useState(0)
  const [cached, setCached] = useState(false)
  const [auto, setAuto] = useState(false)
  const steps = cached ? [DNS_STEPS[0], DNS_STEPS[1], { ...DNS_STEPS[2], what: '¡Cache hit! Respuesta inmediata (dentro del TTL)' }, DNS_STEPS[6]] : DNS_STEPS
  const total = steps.slice(0, step + 1).reduce((a, s) => a + s.ms, 0)
  useEffect(() => {
    if (!auto) return
    if (step >= steps.length - 1) {
      setAuto(false)
      return
    }
    const t = setTimeout(() => setStep((s) => s + 1), 900)
    return () => clearTimeout(t)
  }, [auto, step, steps.length])
  return (
    <Frame title="Resolución DNS paso a paso" icon="🔎">
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <button className="btn btn-primary !py-1.5 text-xs" onClick={() => { setStep(0); setAuto(true) }}>▶ Reproducir</button>
        <button className="btn btn-ghost !py-1.5 text-xs" disabled={step >= steps.length - 1} onClick={() => setStep((s) => s + 1)}>Paso →</button>
        <label className="text-xs flex items-center gap-2 text-muted ml-auto">
          <input type="checkbox" checked={cached} onChange={(e) => { setCached(e.target.checked); setStep(0) }} /> Resolver con caché caliente
        </label>
      </div>
      <ol className="grid gap-1.5">
        {steps.map((s, i) => (
          <motion.li key={`${cached}-${i}`} animate={{ opacity: i <= step ? 1 : 0.3, x: i === step ? 4 : 0 }} className={`rounded-lg border px-3 py-2 text-xs flex gap-3 ${i === step ? 'border-accent bg-accent/10' : 'border-border bg-surface-2'}`}>
            <span className="font-mono text-muted w-4">{i + 1}</span>
            <span className="flex-1">
              <span className="font-semibold">{s.who}</span>
              <span className="text-muted"> — {s.what}</span>
            </span>
            <span className="font-mono text-muted">+{s.ms} ms</span>
          </motion.li>
        ))}
      </ol>
      <div className="text-sm mt-3">
        Latencia acumulada: <span className="font-bold font-mono text-accent">{total} ms</span>
        {cached && <span className="text-muted text-xs"> · el TTL ahorra casi todo el viaje</span>}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
function ReplicationLag() {
  const [lag, setLag] = useState(1500)
  const [ryw, setRyw] = useState(false)
  const [leader, setLeader] = useState(1)
  const [followers, setFollowers] = useState([1, 1])
  const [log, setLog] = useState<{ text: string; stale: boolean }[]>([])
  const lastWrite = useRef(0)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const write = () => {
    const v = leader + 1
    setLeader(v)
    lastWrite.current = Date.now()
    ;[0, 1].forEach((i) => {
      const t = window.setTimeout(() => setFollowers((f) => f.map((x, j) => (j === i ? Math.max(x, v) : x))), lag * (0.6 + i * 0.6))
      timers.current.push(t)
    })
    setLog((l) => [{ text: `✏️ Escribiste v${v} en el líder`, stale: false }, ...l].slice(0, 6))
  }
  const read = () => {
    const toLeader = ryw && Date.now() - lastWrite.current < lag * 2
    if (toLeader) {
      setLog((l) => [{ text: `📖 Leído v${leader} del LÍDER (read-your-writes)`, stale: false }, ...l].slice(0, 6))
      return
    }
    const i = Math.random() < 0.5 ? 0 : 1
    const v = followers[i]
    setLog((l) => [{ text: `📖 Leído v${v} de la réplica ${i + 1}${v < leader ? ' — ¡DATO VIEJO!' : ''}`, stale: v < leader }, ...l].slice(0, 6))
  }
  const staleCount = log.filter((x) => x.stale).length
  return (
    <Frame title="Lag de replicación" icon="⏳">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Slider label="Lag de réplica" min={0} max={4000} step={250} value={lag} onChange={setLag} format={(v) => `${v} ms`} />
          <label className="text-xs flex items-center gap-2 text-muted mt-3">
            <input type="checkbox" checked={ryw} onChange={(e) => setRyw(e.target.checked)} /> Read-your-writes (leer del líder tras escribir)
          </label>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-primary text-xs" onClick={write}>Escribir</button>
            <button className="btn btn-ghost text-xs" onClick={read}>Leer</button>
          </div>
        </div>
        <div className="flex items-center justify-around">
          {[{ name: 'Líder', v: leader }, { name: 'Réplica 1', v: followers[0] }, { name: 'Réplica 2', v: followers[1] }].map((n, i) => (
            <div key={n.name} className="text-center">
              <motion.div
                key={n.v}
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center font-mono font-bold ${i === 0 ? 'border-accent bg-accent/15' : n.v < leader ? 'border-warn bg-warn/10' : 'border-good bg-good/10'}`}
              >
                v{n.v}
              </motion.div>
              <div className="text-[11px] text-muted mt-1">{n.name}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-1">
        <AnimatePresence initial={false}>
          {log.map((l, i) => (
            <motion.div key={log.length - i + l.text} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={`text-xs font-mono ${l.stale ? 'text-warn' : 'text-muted'}`}>
              {l.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {staleCount > 0 && !ryw && <div className="text-xs mt-2 text-warn">Viste {staleCount} lectura(s) vieja(s). Activa read-your-writes y repite.</div>}
    </Frame>
  )
}

export function Widget({ id }: { id: WidgetId }) {
  switch (id) {
    case 'latency-numbers':
      return <LatencyNumbers />
    case 'scaling-compare':
      return <ScalingCompare />
    case 'sql-vs-nosql':
      return <SqlVsNoSql />
    case 'dns-resolution':
      return <DnsResolution />
    case 'replication-lag':
      return <ReplicationLag />
  }
}
