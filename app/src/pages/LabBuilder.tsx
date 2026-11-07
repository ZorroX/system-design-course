import '@xyflow/react/dist/style.css'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Lightbulb, Link2, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { CHALLENGES, type Challenge } from '@/data/challenges'
import { CATALOG, KIND_COLOR, PALETTE, type NodeKind } from '@/lab/catalog'
import { simulate, type NodeStats, type SimResult } from '@/lab/engine'
import { useGame } from '@/store/game'
import { Empty, ProgressBar, Slider, Stat } from '@/components/ui'
import { fmt, fmtMs } from '@/lib/format'
import { celebrate } from '@/lib/fx'

interface NodeData extends Record<string, unknown> {
  kind: NodeKind
  count: number
  down: number
}
type LNode = Node<NodeData>

interface Ctx {
  stats: Record<string, NodeStats>
  setCount: (id: string, delta: number) => void
  remove: (id: string) => void
  connectFrom: string | null
}
const LabCtx = createContext<Ctx>({ stats: {}, setCount: () => {}, remove: () => {}, connectFrom: null })

function utilColor(u: number) {
  if (!isFinite(u) || u > 1) return 'var(--bad)'
  if (u > 0.8) return 'var(--warn)'
  if (u > 0) return 'var(--good)'
  return 'var(--border)'
}

function LabNodeView({ id, data, selected }: NodeProps<LNode>) {
  const { stats, setCount, remove, connectFrom } = useContext(LabCtx)
  const spec = CATALOG[data.kind]
  const st = stats[id]
  const active = st && st.reads + st.writes > 0
  const u = st?.util ?? 0
  const alive = data.count - data.down
  return (
    <div
      className="rounded-2xl border-2 bg-surface px-3 py-2 min-w-[8.5rem] shadow-lg transition-colors"
      style={{ borderColor: connectFrom === id ? 'var(--accent)' : selected ? 'var(--text)' : active ? utilColor(u) : 'var(--border)' }}
    >
      {data.kind !== 'client' && <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5" />}
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5" />
      <div className="flex items-center gap-2">
        <span className="text-xl">{spec.icon}</span>
        <div className="min-w-0">
          <div className="text-xs font-bold leading-tight" style={{ color: KIND_COLOR[data.kind] }}>
            {spec.label}
          </div>
          {data.kind !== 'client' && (
            <div className="text-[10px] text-muted leading-tight">
              ${fmt(spec.cost * data.count)}/mes{data.down ? <span className="text-bad"> · 💀{data.down}</span> : null}
            </div>
          )}
        </div>
        {data.kind !== 'client' && selected && (
          <button className="ml-auto text-muted hover:text-bad nodrag" onClick={() => remove(id)} aria-label="Eliminar">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {spec.max > 1 && (
        <div className="flex items-center justify-between mt-1.5 nodrag">
          <button className="w-6 h-6 rounded-md bg-surface-2 border border-border flex items-center justify-center" onClick={() => setCount(id, -1)} aria-label="Menos">
            <Minus size={12} />
          </button>
          <span className="text-xs font-mono font-bold">
            ×{data.count}
            {data.down ? <span className="text-bad"> ({alive})</span> : null}
          </span>
          <button className="w-6 h-6 rounded-md bg-surface-2 border border-border flex items-center justify-center" onClick={() => setCount(id, 1)} aria-label="Más">
            <Plus size={12} />
          </button>
        </div>
      )}
      {active && data.kind !== 'client' && (
        <div className="mt-1.5">
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (isFinite(u) ? u : 1) * 100)}%`, background: utilColor(u) }} />
          </div>
          <div className="flex justify-between text-[9px] text-muted mt-0.5 font-mono">
            <span>{isFinite(u) ? `${Math.round(u * 100)}%` : 'CAÍDO'}</span>
            <span>{fmt(st.reads + st.writes)}/s</span>
          </div>
        </div>
      )}
    </div>
  )
}

const nodeTypes = { lab: LabNodeView }

const START: LNode[] = [{ id: 'client', type: 'lab', position: { x: 0, y: 120 }, data: { kind: 'client', count: 1, down: 0 }, deletable: false }]

function loadDesign(id: string): { nodes: LNode[]; edges: Edge[] } | null {
  try {
    const raw = localStorage.getItem(`sdq-lab-${id}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function Check({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs border ${ok ? 'border-good/40 bg-good/10' : 'border-bad/40 bg-bad/10'}`}>
      <span>
        {ok ? '✅' : '❌'} {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

function Builder({ ch }: { ch: Challenge }) {
  const saved = useMemo(() => loadDesign(ch.id), [ch.id])
  const [nodes, setNodes] = useState<LNode[]>(saved?.nodes ?? START)
  const [edges, setEdges] = useState<Edge[]>(saved?.edges ?? [])
  const [mult, setMult] = useState(1)
  const [hints, setHints] = useState(0)
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [chaosMsg, setChaosMsg] = useState<string | null>(null)
  const [evaluated, setEvaluated] = useState<SimResult | null>(null)
  const saveLab = useGame((s) => s.saveLab)
  const best = useGame((s) => s.labs[ch.id])
  const setChaosSurvived = useGame((s) => s.setChaosSurvived)
  const counter = useRef(nodes.length + 1)

  useEffect(() => {
    try {
      localStorage.setItem(`sdq-lab-${ch.id}`, JSON.stringify({ nodes: nodes.map((n) => ({ ...n, selected: false })), edges }))
    } catch {
      /* almacenamiento no disponible */
    }
  }, [nodes, edges, ch.id])

  const result = useMemo(
    () =>
      simulate(
        nodes.map((n) => ({ id: n.id, kind: n.data.kind, count: n.data.count, down: n.data.down })),
        edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        ch,
        mult,
      ),
    [nodes, edges, ch, mult],
  )

  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const load = result.edges[e.id] ?? 0
        const tgt = result.nodes[e.target]
        const color = load > 0 ? utilColor(tgt?.util ?? 0) : 'var(--border)'
        return {
          ...e,
          animated: load > 0,
          label: load > 0 ? `${fmt(load)}/s` : undefined,
          labelStyle: { fontSize: 10, fill: 'var(--muted)', fontFamily: 'JetBrains Mono' },
          labelBgStyle: { fill: 'var(--bg)' },
          style: { stroke: color, strokeWidth: load > 0 ? 1.5 + Math.min(4, Math.log10(load + 1)) : 1.5 },
        }
      }),
    [edges, result],
  )

  const onNodesChange = useCallback((c: NodeChange<LNode>[]) => setNodes((n) => applyNodeChanges(c, n)), [])
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((e) => applyEdgeChanges(c, e)), [])
  const connect = useCallback((source: string, target: string) => {
    if (source === target) return
    setEdges((e) => (e.some((x) => x.source === source && x.target === target) ? e : addEdge({ id: `e-${source}-${target}`, source, target }, e)))
    setEvaluated(null)
  }, [])
  const onConnect = useCallback((c: Connection) => c.source && c.target && connect(c.source, c.target), [connect])

  const add = (kind: NodeKind) => {
    const id = `${kind}-${counter.current++}`
    const sameKind = nodes.filter((n) => n.data.kind === kind).length
    const col = ['cdn', 'lb', 'gateway'].includes(kind) ? 1 : kind === 'app' ? 2 : ['cache', 'queue', 'storage'].includes(kind) ? 3 : 4
    const spec = CATALOG[kind]
    setNodes((n) => [
      ...n.map((x) => ({ ...x, selected: false })),
      { id, type: 'lab', position: { x: col * 210, y: 20 + sameKind * 110 + (kind.length % 3) * 40 }, data: { kind, count: kind === 'app' ? 2 : spec.min, down: 0 }, selected: true },
    ])
    setEvaluated(null)
  }

  const ctx: Ctx = {
    stats: result.nodes,
    connectFrom,
    setCount: (id, delta) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n
          const spec = CATALOG[n.data.kind]
          const count = Math.max(spec.min, Math.min(spec.max, n.data.count + delta))
          return { ...n, data: { ...n.data, count, down: Math.min(n.data.down, count) } }
        }),
      )
      setEvaluated(null)
    },
    remove: (id) => {
      setNodes((ns) => ns.filter((n) => n.id !== id))
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
      setEvaluated(null)
    },
  }

  const onNodeClick = (_: unknown, node: LNode) => {
    if (!connectMode) return
    if (!connectFrom) setConnectFrom(node.id)
    else {
      connect(connectFrom, node.id)
      setConnectFrom(null)
    }
  }

  const evaluate = () => {
    setEvaluated(result)
    saveLab(ch.id, { stars: result.stars, score: result.score.total, cost: result.cost })
    if (result.stars >= 2) celebrate(result.stars === 3 ? 'big' : 'small')
  }

  const chaos = () => {
    const candidates = nodes.filter((n) => CATALOG[n.data.kind].critical && n.data.count - n.data.down > 0 && (result.nodes[n.id]?.reads ?? 0) + (result.nodes[n.id]?.writes ?? 0) > 0)
    if (!candidates.length) return
    const victim = candidates[Math.floor(Math.random() * candidates.length)]
    const nextNodes = nodes.map((n) => (n.id === victim.id ? { ...n, data: { ...n.data, down: n.data.down + 1 } } : n))
    setNodes(nextNodes)
    setEvaluated(null)
    const after = simulate(
      nextNodes.map((n) => ({ id: n.id, kind: n.data.kind, count: n.data.count, down: n.data.down })),
      edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      ch,
      mult,
    )
    const survived = after.errorRate <= 0.01 && after.p99 <= ch.p99 * 1.5
    setChaosMsg(`🐒 Chaos Monkey apagó una instancia de ${CATALOG[victim.data.kind].label}. ${survived ? '¡Tu sistema sobrevivió! 💪' : `Errores: ${(after.errorRate * 100).toFixed(1)}% · p99 ${fmtMs(after.p99)}`}`)
    if (survived && mult >= 1) setChaosSurvived()
  }
  const heal = () => {
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, down: 0 } })))
    setChaosMsg(null)
  }
  const reset = () => {
    setNodes(START)
    setEdges([])
    setEvaluated(null)
    setChaosMsg(null)
  }
  const selected = nodes.some((n) => n.selected && n.id !== 'client') || edges.some((e) => e.selected)
  const deleteSelected = () => {
    const ids = new Set(nodes.filter((n) => n.selected && n.id !== 'client').map((n) => n.id))
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)))
    setEdges((es) => es.filter((e) => !e.selected && !ids.has(e.source) && !ids.has(e.target)))
  }

  const r = result
  const show = evaluated ?? r
  const hasDowned = nodes.some((n) => n.data.down > 0)

  return (
    <LabCtx.Provider value={ctx}>
      <div className="grid gap-4 [&>*]:min-w-0">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="min-w-0">
            <Link to="/lab" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-1">
              <ArrowLeft size={16} /> Retos
            </Link>
            <h1 className="text-xl sm:text-2xl font-extrabold">
              {ch.emoji} {ch.title}
            </h1>
            <p className="text-sm text-muted max-w-2xl">{ch.story}</p>
          </div>
          {best && (
            <div className="text-sm text-muted">
              Mejor: <span className="text-warn">{'★'.repeat(best.stars)}{'☆'.repeat(3 - best.stars)}</span> {best.score}/100
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="chip">🎯 {fmt(ch.rps)} RPS</span>
          <span className="chip">📖 {Math.round(ch.readRatio * 100)}% lecturas</span>
          {ch.staticShare > 0 && <span className="chip">🖼️ {Math.round(ch.staticShare * 100)}% de lecturas estáticas</span>}
          <span className="chip">⚡ hit rate caché {Math.round(ch.cacheHit * 100)}%</span>
          <span className="chip">⏱ p99 &lt; {ch.p99} ms</span>
          <span className="chip">🛡️ ≥ {(ch.availability * 100).toFixed(2)}%</span>
          <span className="chip">💰 ≤ ${fmt(ch.budget)}/mes</span>
          {ch.requires.map((k) => (
            <span key={k} className={`chip ${r.missing.includes(k) ? '!text-bad !border-bad/40' : '!text-good !border-good/40'}`}>
              {r.missing.includes(k) ? '✗' : '✓'} requiere {CATALOG[k].label}
            </span>
          ))}
        </div>

        {/* Paleta */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
          {PALETTE.map((k) => (
            <button key={k} onClick={() => add(k)} className="shrink-0 card px-3 py-2 flex items-center gap-2 hover:border-accent/60 active:scale-95 transition" title={CATALOG[k].desc}>
              <span className="text-lg">{CATALOG[k].icon}</span>
              <span className="text-left">
                <span className="block text-xs font-bold">{CATALOG[k].label}</span>
                <span className="block text-[10px] text-muted">${CATALOG[k].cost}/u</span>
              </span>
            </button>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1fr_22rem] gap-4">
          <div className="card relative overflow-hidden h-[60vh] min-h-[420px]">
            <ReactFlow
              nodes={nodes}
              edges={styledEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
              minZoom={0.3}
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <Background gap={24} color="var(--border)" />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
            <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-2 pointer-events-none">
              <button className={`pointer-events-auto btn !py-1.5 text-xs ${connectMode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setConnectMode((c) => !c); setConnectFrom(null) }}>
                <Link2 size={14} /> {connectMode ? (connectFrom ? 'Toca el destino…' : 'Toca el origen…') : 'Conectar tocando'}
              </button>
              {selected && (
                <button className="pointer-events-auto btn btn-ghost !py-1.5 text-xs !border-bad/50" onClick={deleteSelected}>
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
              <button className="pointer-events-auto btn btn-ghost !py-1.5 text-xs ml-auto" onClick={reset}>
                <RotateCcw size={14} /> Reiniciar
              </button>
            </div>
            {nodes.length === 1 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-sm text-muted max-w-xs px-4 bg-bg/80 rounded-xl py-3">
                  Agrega componentes desde la paleta y conéctalos arrastrando desde el punto derecho de un nodo al izquierdo de otro (o usa <b>Conectar tocando</b>).
                </div>
              </div>
            )}
          </div>

          {/* Resultados */}
          <div className="grid gap-3 content-start">
            <div className="card p-4 grid gap-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">Simulación en vivo</div>
                <span className="text-warn tracking-wider">{'★'.repeat(r.stars)}<span className="text-border">{'★'.repeat(3 - r.stars)}</span></span>
              </div>
              <Slider label="Multiplicador de tráfico" min={0.5} max={3} step={0.25} value={mult} onChange={setMult} format={(v) => `×${v} (${fmt(ch.rps * v)} RPS)`} />
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Errores" value={`${(r.errorRate * 100).toFixed(r.errorRate < 0.1 ? 2 : 1)}%`} color={r.passed.throughput ? 'var(--good)' : 'var(--bad)'} />
                <Stat label="p99" value={r.p99 ? fmtMs(r.p99) : '—'} color={r.passed.latency ? 'var(--good)' : 'var(--bad)'} sub={`media ${fmtMs(r.avgLatency)}`} />
                <Stat label="Disponibilidad" value={r.availability ? `${(r.availability * 100).toFixed(r.availability > 0.999 ? 3 : 2)}%` : '—'} color={r.passed.availability ? 'var(--good)' : 'var(--bad)'} />
                <Stat label="Costo" value={`$${fmt(r.cost)}`} color={r.passed.cost ? 'var(--good)' : 'var(--bad)'} sub="/mes" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">Puntuación</span>
                  <span className="font-bold">{r.score.total}/100</span>
                </div>
                <ProgressBar value={r.score.total / 100} color={r.score.total >= 90 ? 'var(--good)' : r.score.total >= 50 ? 'var(--warn)' : 'var(--bad)'} />
              </div>
              <div className="grid gap-1.5">
                <Check ok={r.passed.throughput} label="Throughput (errores ≤ 1%)" value={`${(r.errorRate * 100).toFixed(1)}%`} />
                <Check ok={r.passed.latency} label={`p99 < ${ch.p99} ms`} value={r.p99 ? fmtMs(r.p99) : '—'} />
                <Check ok={r.passed.availability} label={`Disponibilidad ≥ ${(ch.availability * 100).toFixed(2)}%`} value={`${(r.availability * 100).toFixed(3)}%`} />
                <Check ok={r.passed.cost} label={`Presupuesto ≤ $${fmt(ch.budget)}`} value={`$${fmt(r.cost)}`} />
                {ch.requires.length > 0 && <Check ok={r.passed.requirements} label="Componentes requeridos" value={r.missing.length ? `faltan ${r.missing.length}` : 'ok'} />}
              </div>
              <button className="btn btn-primary" onClick={evaluate} disabled={nodes.length < 2 || hasDowned}>
                {hasDowned ? 'Restaura las instancias para evaluar' : 'Evaluar y guardar diseño'}
              </button>
              <AnimatePresence>
                {evaluated && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-warn/50 bg-warn/10 p-3 text-center">
                    <div className="text-3xl tracking-widest">
                      {[1, 2, 3].map((s) => (
                        <motion.span key={s} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: s * 0.15, type: 'spring' }} className={s <= show.stars ? 'text-warn inline-block' : 'text-border inline-block'}>
                          ★
                        </motion.span>
                      ))}
                    </div>
                    <div className="text-sm font-bold mt-1">{show.stars === 3 ? '¡Diseño de nivel Staff!' : show.stars === 2 ? 'Muy bien. ¿Puedes optimizar costo o latencia?' : show.stars === 1 ? 'Funciona, pero tiene problemas serios.' : 'Aún no cumple los requisitos.'}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="card p-4 grid gap-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">🐒 Chaos engineering</div>
                {hasDowned && (
                  <button className="text-xs text-accent" onClick={heal}>
                    Restaurar
                  </button>
                )}
              </div>
              <button className="btn btn-ghost !border-bad/50" onClick={chaos} disabled={nodes.length < 2}>
                Soltar al Chaos Monkey
              </button>
              {chaosMsg && <div className="text-xs">{chaosMsg}</div>}
            </div>

            {(r.spofs.length > 0 || r.warnings.length > 0 || r.backlog) && (
              <div className="card p-4 grid gap-2 text-xs">
                <div className="font-bold uppercase tracking-wide text-muted">Diagnóstico</div>
                {r.spofs.map((s) => (
                  <div key={s} className="text-warn">⚠️ Punto único de fallo: {s} (usa ×2 o más)</div>
                ))}
                {r.warnings.map((w) => (
                  <div key={w} className="text-muted">💬 {w}</div>
                ))}
              </div>
            )}

            <div className="card p-4 grid gap-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">Pistas</div>
                {hints < ch.hints.length && (
                  <button className="text-xs text-accent inline-flex items-center gap-1" onClick={() => setHints((h) => h + 1)}>
                    <Lightbulb size={12} /> Ver pista ({hints}/{ch.hints.length})
                  </button>
                )}
              </div>
              {ch.hints.slice(0, hints).map((h) => (
                <motion.div key={h} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted">
                  💡 {h}
                </motion.div>
              ))}
              {!hints && <div className="text-xs text-muted">Intenta primero sin pistas. Recuerda: deja ~30% de margen en cada componente.</div>}
            </div>
          </div>
        </div>
        <ModelNotes />
      </div>
    </LabCtx.Provider>
  )
}

function ModelNotes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card p-4 text-sm">
      <button className="font-bold flex items-center gap-2 w-full text-left" onClick={() => setOpen((o) => !o)}>
        📐 ¿Cómo calcula el simulador? {open ? <X size={14} className="ml-auto" /> : <span className="ml-auto text-xs text-accent">ver</span>}
      </button>
      {open && (
        <ul className="mt-3 grid gap-1.5 text-muted text-xs list-disc pl-5">
          <li>El tráfico se divide en lecturas estáticas (media), lecturas dinámicas, escrituras síncronas y asíncronas, y fluye por las conexiones en la dirección de las flechas.</li>
          <li>La CDN sirve el 95% de lo estático; la caché sirve su hit rate y el resto va a la DB; si hay réplicas, las lecturas van a ellas; las escrituras van al SQL primario o NoSQL; con una cola, las escrituras asíncronas se aceptan al encolar y los workers las persisten (la DB ve ~70% del pico).</li>
          <li>Utilización = carga / (capacidad × instancias). Por encima del 100% se descartan peticiones (errores). La latencia de cada nodo crece con la utilización (aprox. de colas M/M/1): a 90% se multiplica ~5×.</li>
          <li>Disponibilidad: las capas críticas van en serie; las instancias de una capa, en paralelo: 1 − (1 − a)ⁿ. Caché, réplicas y workers no son críticos (hay fallback o son asíncronos).</li>
          <li>Es un modelo didáctico: los órdenes de magnitud y los trade-offs son realistas, los números exactos no.</li>
        </ul>
      )}
    </div>
  )
}

export default function LabBuilder() {
  const { id } = useParams()
  const ch = CHALLENGES.find((c) => c.id === id)
  if (!ch) return <Empty icon="🧪" title="Reto no encontrado" />
  return (
    <ReactFlowProvider>
      <Builder key={ch.id} ch={ch} />
    </ReactFlowProvider>
  )
}
