/**
 * Motor de capacidad del Design Lab.
 * Modelo simplificado (pero honesto) de cómo fluye el tráfico por una arquitectura:
 *  - lecturas estáticas (media), lecturas dinámicas, escrituras síncronas y asíncronas
 *  - utilización por nodo = carga / capacidad; saturación => descartes (errores)
 *  - latencia por nodo crece con la utilización (aproximación de colas M/M/1)
 *  - disponibilidad: capas críticas en serie, instancias en paralelo
 */
import { CATALOG, type NodeKind } from './catalog.ts'
import type { Challenge } from '../data/challenges.ts'

export interface LabNode {
  id: string
  kind: NodeKind
  count: number
  down?: number // instancias caídas (chaos)
}
export interface LabEdge {
  id: string
  source: string
  target: string
}

export interface NodeStats {
  reads: number
  writes: number
  util: number
  latency: number
  drop: number
}

export interface SimResult {
  nodes: Record<string, NodeStats>
  edges: Record<string, number>
  totalRps: number
  errorRate: number
  avgLatency: number
  p99: number
  availability: number
  cost: number
  spofs: string[]
  warnings: string[]
  missing: NodeKind[]
  backlog: boolean
  score: { throughput: number; latency: number; availability: number; cost: number; total: number }
  stars: number
  passed: { throughput: boolean; latency: boolean; availability: boolean; cost: boolean; requirements: boolean }
}

interface Traffic {
  s: number // lecturas estáticas
  r: number // lecturas dinámicas
  w: number // escrituras síncronas
  a: number // escrituras asíncronas
}

const DB_KINDS: NodeKind[] = ['sql', 'replica', 'nosql']
const COMPUTE_KINDS: NodeKind[] = ['lb', 'gateway', 'app', 'cdn']
const CDN_HIT = 0.95
const QUEUE_SMOOTHING = 0.7

const ASYNC_SHARE: Record<string, number> = {
  blog: 0,
  'url-shortener': 0,
  ecommerce: 0.7,
  chat: 0.8,
  video: 0.9,
  payments: 0.3,
}

export function effectiveCount(n: LabNode) {
  return Math.max(0, n.count - (n.down ?? 0))
}

export function simulate(nodes: LabNode[], edges: LabEdge[], ch: Challenge, mult = 1): SimResult {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, LabEdge[]>()
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    out.set(e.source, [...(out.get(e.source) ?? []), e])
  }
  const kidsOf = (id: string) => (out.get(id) ?? []).map((e) => ({ edge: e, node: byId.get(e.target)! }))

  const stats: Record<string, NodeStats> = {}
  for (const n of nodes) stats[n.id] = { reads: 0, writes: 0, util: 0, latency: 0, drop: 0 }
  const edgeLoad: Record<string, number> = {}
  const warnings = new Set<string>()

  const total = ch.rps * mult
  const asyncShare = ASYNC_SHARE[ch.id] ?? 0
  const start: Traffic = {
    s: total * ch.readRatio * ch.staticShare,
    r: total * ch.readRatio * (1 - ch.staticShare),
    w: total * (1 - ch.readRatio) * (1 - asyncShare),
    a: total * (1 - ch.readRatio) * asyncShare,
  }

  type Mode = 'load' | 'measure'
  let mode: Mode = 'load'
  let unrouted = 0
  const samples: { lat: number; rps: number; surv: number }[] = []
  let backlog = false

  const sum = (t: Traffic) => t.s + t.r + t.w + t.a
  const scale = (t: Traffic, f: number): Traffic => ({ s: t.s * f, r: t.r * f, w: t.w * f, a: t.a * f })

  function nodeLatency(n: LabNode) {
    const st = stats[n.id]
    const rho = Math.min(st.util, 0.95)
    return CATALOG[n.kind].latency * (1 + (0.5 * rho * rho) / (1 - rho))
  }

  function record(lat: number, rps: number, surv: number, background: boolean) {
    if (mode !== 'measure' || rps <= 0) return
    if (background) return
    samples.push({ lat, rps, surv })
  }

  function lose(rps: number, background: boolean, why?: string) {
    if (why) warnings.add(why)
    if (mode === 'measure' && !background) unrouted += rps
  }

  function send(kids: { edge: LabEdge; node: LabNode }[], t: Traffic, lat: number, surv: number, depth: number, bg: boolean, dbs?: LabNode[]) {
    if (!kids.length) return
    const share = 1 / kids.length
    for (const k of kids) {
      const part = scale(t, share)
      if (mode === 'load') edgeLoad[k.edge.id] = (edgeLoad[k.edge.id] ?? 0) + sum(part)
      visit(k.node, part, lat, surv, depth + 1, bg, dbs)
    }
  }

  /** Reparte lecturas/escrituras a la capa de datos. */
  function dbTier(dbKids: { edge: LabEdge; node: LabNode }[], reads: number, writes: number, lat: number, surv: number, depth: number, bg: boolean) {
    const replicas = dbKids.filter((k) => k.node.kind === 'replica')
    const nosql = dbKids.filter((k) => k.node.kind === 'nosql')
    const sql = dbKids.filter((k) => k.node.kind === 'sql')
    const readers = replicas.length ? [...replicas, ...nosql] : [...sql, ...nosql]
    const writers = [...sql, ...nosql]
    const weight = (n: LabNode) => (n.kind === 'sql' ? (effectiveCount(n) > 0 ? 1 : 0) : effectiveCount(n)) || 0.0001

    const distribute = (targets: typeof dbKids, amount: number, field: 'r' | 'w') => {
      const wsum = targets.reduce((acc, k) => acc + weight(k.node), 0)
      for (const k of targets) {
        const part = (amount * weight(k.node)) / wsum
        const t: Traffic = { s: 0, r: field === 'r' ? part : 0, w: field === 'w' ? part : 0, a: 0 }
        if (mode === 'load') edgeLoad[k.edge.id] = (edgeLoad[k.edge.id] ?? 0) + part
        visit(k.node, t, lat, surv, depth + 1, bg)
      }
    }
    if (reads > 0) {
      if (readers.length) distribute(readers, reads, 'r')
      else lose(reads, bg, 'Hay lecturas que no llegan a ninguna base de datos.')
    }
    if (writes > 0) {
      if (writers.length) distribute(writers, writes, 'w')
      else lose(writes, bg, 'Las escrituras no tienen dónde persistirse (falta SQL o NoSQL; las réplicas son de solo lectura).')
    }
  }

  function visit(n: LabNode, t: Traffic, lat: number, surv: number, depth: number, bg: boolean, ctxDbs?: LabNode[]) {
    if (depth > 14) return lose(sum(t), bg, 'Hay un ciclo en el grafo.')
    const st = stats[n.id]
    const spec = CATALOG[n.kind]
    if (mode === 'load') {
      st.reads += t.s + t.r
      st.writes += t.w + t.a
    }
    const here = mode === 'measure' ? nodeLatency(n) : 0
    const L = lat + here
    const S = surv * (1 - (mode === 'measure' ? st.drop : 0))
    const kids = kidsOf(n.id)
    const of = (...kinds: NodeKind[]) => kids.filter((k) => kinds.includes(k.node.kind))

    switch (n.kind) {
      case 'client': {
        const cdn = of('cdn')
        const rest = kids.filter((k) => k.node.kind !== 'cdn')
        if (!kids.length) return lose(sum(t), bg, 'Conecta a los usuarios con algún componente.')
        if (cdn.length && rest.length) {
          send(cdn, { s: t.s, r: 0, w: 0, a: 0 }, L, S, depth, bg)
          send(rest, { s: 0, r: t.r, w: t.w, a: t.a }, L, S, depth, bg)
        } else send(kids, t, L, S, depth, bg)
        return
      }
      case 'cdn': {
        record(L, t.s * CDN_HIT, S, bg)
        const miss: Traffic = { s: t.s * (1 - CDN_HIT), r: t.r, w: t.w, a: t.a }
        const storage = of('storage')
        const compute = kids.filter((k) => COMPUTE_KINDS.includes(k.node.kind))
        if (storage.length) {
          send(storage, { s: miss.s, r: 0, w: 0, a: 0 }, L, S, depth, bg)
          miss.s = 0
        }
        if (sum(miss) > 0) {
          if (compute.length) send(compute, miss, L, S, depth, bg)
          else lose(sum(miss), bg, 'La CDN no tiene origen para el tráfico dinámico: conéctala a un LB/app o conecta los usuarios directamente al LB.')
        }
        return
      }
      case 'lb':
      case 'gateway': {
        if (!kids.length) return lose(sum(t), bg, `${spec.label} sin destinos.`)
        send(kids, t, L, S, depth, bg)
        return
      }
      case 'app': {
        const storage = of('storage')
        const caches = of('cache')
        const queues = of('queue')
        const dbs = of(...DB_KINDS)
        let reads = t.r
        if (t.s > 0) {
          if (storage.length) send(storage, { s: t.s, r: 0, w: 0, a: 0 }, L, S, depth, bg)
          else {
            reads += t.s
            if (ch.staticShare > 0.3) warnings.add('Estás sirviendo media/archivos desde la base de datos: usa Object Storage (+ CDN).')
          }
        }
        let syncW = t.w
        if (t.a > 0) {
          if (queues.length) send(queues, { s: 0, r: 0, w: 0, a: t.a }, L, S, depth, bg, dbs.map((d) => d.node))
          else syncW += t.a
        }
        if (reads > 0 && caches.length) {
          send(caches, { s: 0, r: reads, w: 0, a: 0 }, L, S, depth, bg, dbs.map((d) => d.node))
          reads = 0
        }
        if (reads > 0 || syncW > 0) {
          dbTier(dbs, reads, syncW, L, S, depth, bg)
        }
        if (!dbs.length && !caches.length && !storage.length && !queues.length && sum(t) > 0) {
          warnings.add('Un App Server no está conectado a ninguna fuente de datos.')
        }
        return
      }
      case 'cache': {
        const hits = t.r * ch.cacheHit
        record(L, hits, S, bg)
        const misses = t.r - hits
        const own = of(...DB_KINDS)
        const fallback = (ctxDbs ?? []).map((d) => ({ edge: { id: `__virtual_${n.id}_${d.id}`, source: n.id, target: d.id }, node: d }))
        const tier = own.length ? own : fallback
        if (misses > 0) dbTier(tier, misses, 0, L, S, depth, bg)
        return
      }
      case 'queue': {
        record(L, t.a, S, bg) // el usuario recibe el "aceptado" aquí
        const workers = of('worker')
        if (!workers.length) return lose(0, true, 'La cola no tiene workers: los mensajes se acumulan para siempre.')
        send(workers, { s: 0, r: 0, w: 0, a: t.a * QUEUE_SMOOTHING }, L, S, depth, true, ctxDbs)
        return
      }
      case 'worker': {
        const own = of(...DB_KINDS)
        const fallback = (ctxDbs ?? []).map((d) => ({ edge: { id: `__virtual_${n.id}_${d.id}`, source: n.id, target: d.id }, node: d }))
        dbTier(own.length ? own : fallback, 0, t.a + t.w, L, S, depth, true)
        return
      }
      case 'sql':
      case 'replica':
      case 'nosql':
      case 'storage': {
        if (n.kind === 'replica' && t.w > 0) warnings.add('Las réplicas de lectura no aceptan escrituras.')
        record(L, sum(t), S, bg)
        return
      }
    }
  }

  // Pasada 1: cargas
  const clients = nodes.filter((n) => n.kind === 'client')
  for (const c of clients) visit(c, scale(start, 1 / clients.length), 0, 1, 0, false)

  // Utilización y descartes
  for (const n of nodes) {
    const st = stats[n.id]
    const spec = CATALOG[n.kind]
    const cnt = n.kind === 'sql' ? Math.min(1, effectiveCount(n)) : effectiveCount(n)
    if (n.kind === 'client') continue
    if (cnt <= 0) {
      st.util = st.reads + st.writes > 0 ? Infinity : 0
      st.drop = st.reads + st.writes > 0 ? 1 : 0
      continue
    }
    st.util = spec.writeCap ? st.reads / (spec.cap * cnt) + st.writes / (spec.writeCap * cnt) : (st.reads + st.writes) / (spec.cap * cnt)
    st.drop = st.util > 1 ? 1 - 1 / st.util : 0
    if (n.kind === 'worker' && st.util > 1) backlog = true
  }
  // Workers saturados no generan errores al usuario, pero sí lag
  for (const n of nodes) if (n.kind === 'worker') stats[n.id].drop = 0
  if (backlog) warnings.add('Los workers no dan abasto: la cola crece sin parar (lag). Añade instancias.')

  // Pasada 2: latencias y errores
  mode = 'measure'
  for (const c of clients) visit(c, scale(start, 1 / clients.length), 0, 1, 0, false)
  for (const n of nodes) stats[n.id].latency = n.kind === 'client' ? 0 : nodeLatency(n)

  const syncTotal = start.s + start.r + start.w + start.a
  const errors = samples.reduce((acc, s) => acc + s.rps * (1 - s.surv), 0) + unrouted
  const errorRate = syncTotal ? Math.min(1, errors / syncTotal) : 0
  const ok = samples.filter((s) => s.rps * s.surv > 0).sort((a, b) => a.lat - b.lat)
  const okTotal = ok.reduce((acc, s) => acc + s.rps * s.surv, 0)
  const avgLatency = okTotal ? ok.reduce((acc, s) => acc + s.lat * s.rps * s.surv, 0) / okTotal : 0
  let p99 = 0
  let cum = 0
  for (const s of ok) {
    cum += s.rps * s.surv
    p99 = s.lat
    if (cum >= okTotal * 0.99) break
  }
  p99 = p99 * 1.4 // la cola real es más pesada que el promedio por ruta

  // Disponibilidad: capas críticas que reciben tráfico
  const tiers = new Map<NodeKind, LabNode[]>()
  for (const n of nodes) {
    const st = stats[n.id]
    if (!CATALOG[n.kind].critical || st.reads + st.writes <= 0) continue
    tiers.set(n.kind, [...(tiers.get(n.kind) ?? []), n])
  }
  let availability = 1
  const spofs: string[] = []
  for (const [kind, list] of tiers) {
    const a = CATALOG[kind].availability
    const fail = list.reduce((acc, n) => acc * Math.pow(1 - a, Math.max(effectiveCount(n), 0)), 1)
    availability *= 1 - Math.min(1, fail)
    const instances = list.reduce((acc, n) => acc + effectiveCount(n), 0)
    if (instances <= 1 && CATALOG[kind].max > 1) spofs.push(CATALOG[kind].label)
  }
  if (!tiers.size) availability = 0

  const cost = nodes.reduce((acc, n) => acc + CATALOG[n.kind].cost * n.count, 0)

  const present = new Set(nodes.filter((n) => stats[n.id].reads + stats[n.id].writes > 0).map((n) => n.kind))
  const missing = ch.requires.filter((k) => !present.has(k))

  const nines = (a: number) => (a >= 1 ? 6 : -Math.log10(1 - a))
  const passed = {
    throughput: errorRate <= 0.01,
    latency: p99 > 0 && p99 <= ch.p99,
    availability: availability >= ch.availability,
    cost: cost <= ch.budget,
    requirements: missing.length === 0,
  }
  const score = {
    throughput: passed.throughput ? 30 : 30 * Math.max(0, 1 - (errorRate - 0.01) / 0.2),
    latency: passed.latency ? 25 : p99 === 0 ? 0 : 25 * Math.max(0, 1 - (p99 - ch.p99) / ch.p99),
    availability: passed.availability ? 25 : 25 * Math.max(0, 1 - (nines(ch.availability) - nines(availability))),
    cost: passed.cost ? 20 : 20 * Math.max(0, 1 - (cost - ch.budget) / ch.budget),
    total: 0,
  }
  score.total = Math.round(score.throughput + score.latency + score.availability + score.cost - missing.length * 15)
  score.total = Math.max(0, Math.min(100, score.total))
  let stars = score.total >= 90 ? 3 : score.total >= 70 ? 2 : score.total >= 50 ? 1 : 0
  if (!passed.requirements) stars = Math.min(stars, 1)
  if (!passed.throughput || !passed.availability) stars = Math.min(stars, 2)

  return {
    nodes: stats,
    edges: edgeLoad,
    totalRps: total,
    errorRate,
    avgLatency,
    p99,
    availability,
    cost,
    spofs,
    warnings: [...warnings],
    missing,
    backlog,
    score,
    stars,
    passed,
  }
}
