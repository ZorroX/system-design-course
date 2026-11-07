import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { ChallengeBanner, Segmented, Slider, Stat } from '@/components/ui'
import { useColors } from '@/lib/hooks'
import { hash01 } from '@/lib/random'
import type { SimProps } from './index'

const KEYS = 400
const NODE_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#f87171', '#a3e635']
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function buildRing(nodes: number[], vnodes: number) {
  const pts: { h: number; node: number }[] = []
  for (const n of nodes) for (let i = 0; i < vnodes; i++) pts.push({ h: hash01(`node-${n}#${i}`), node: n })
  return pts.sort((a, b) => a.h - b.h)
}
function owner(pts: { h: number; node: number }[], h: number) {
  let lo = 0
  let hi = pts.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (pts[mid].h < h) lo = mid + 1
    else hi = mid
  }
  return pts[lo % pts.length].node
}

const keyHashes = Array.from({ length: KEYS }, (_, k) => hash01(`key-${k}`))

export default function HashRingSim({ done, onComplete }: SimProps) {
  const colors = useColors()
  const [nodes, setNodes] = useState([0, 1, 2])
  const [vnodes, setVnodes] = useState(1)
  const [mode, setMode] = useState<'ring' | 'mod'>('ring')
  const [prev, setPrev] = useState<number[] | null>(null)

  const ring = useMemo(() => buildRing(nodes, vnodes), [nodes, vnodes])
  const assign = useMemo(
    () => keyHashes.map((h) => (mode === 'ring' ? owner(ring, h) : nodes[Math.floor(h * 4294967296) % nodes.length])),
    [ring, mode, nodes],
  )
  const moved = prev ? assign.filter((a, i) => a !== prev[i]).length : 0

  const counts = nodes.map((n) => assign.filter((a) => a === n).length)
  const avg = KEYS / nodes.length
  const maxRatio = Math.max(...counts) / avg

  useEffect(() => {
    if (!done && mode === 'ring' && nodes.length >= 4 && maxRatio <= 1.25) onComplete()
  }, [done, mode, nodes.length, maxRatio, onComplete])

  const change = (fn: (n: number[]) => number[]) => {
    setPrev(assign)
    setNodes(fn)
  }
  const add = () => change((n) => (n.length >= 8 ? n : [...n, [0, 1, 2, 3, 4, 5, 6, 7].find((x) => !n.includes(x))!]))
  const remove = (id: number) => change((n) => (n.length <= 1 ? n : n.filter((x) => x !== id)))

  const R = 130
  const C = 160
  const pos = (h: number, r: number) => ({ x: C + r * Math.sin(h * 2 * Math.PI), y: C - r * Math.cos(h * 2 * Math.PI) })

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="Balance perfecto" done={done}>
        Con <b>4 o más nodos</b> en modo anillo, consigue que el nodo más cargado no supere <b>1.25×</b> el promedio. Ahora: <span className="font-mono text-text">{maxRatio.toFixed(2)}×</span>
      </ChallengeBanner>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-2 flex justify-center bg-grid">
          <svg viewBox="0 0 320 320" className="w-full max-w-[420px] h-auto">
            <circle cx={C} cy={C} r={R} fill="none" stroke={colors.border} strokeWidth={10} />
            {mode === 'ring' &&
              ring.map((p, i) => {
                const a = pos(p.h, R)
                return <circle key={`${p.node}-${i}`} cx={a.x} cy={a.y} r={vnodes > 20 ? 3 : 6} fill={NODE_COLORS[p.node]} stroke={colors.surface} strokeWidth={1.5} />
              })}
            {keyHashes.map((h, k) => {
              const a = pos(h, R - 22 - (k % 4) * 7)
              return (
                <motion.circle
                  key={k}
                  cx={a.x}
                  cy={a.y}
                  r={2.2}
                  animate={{ fill: NODE_COLORS[assign[k]], scale: prev && prev[k] !== assign[k] ? [1, 2.2, 1] : 1 }}
                  transition={{ duration: 0.6 }}
                />
              )
            })}
            <text x={C} y={C - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill={colors.text}>
              {mode === 'ring' ? `${nodes.length} nodos × ${vnodes} vnodes` : `hash % ${nodes.length}`}
            </text>
            <text x={C} y={C + 12} textAnchor="middle" fontSize={10} fill={colors.muted}>
              {KEYS} claves
            </text>
            {prev && (
              <text x={C} y={C + 30} textAnchor="middle" fontSize={11} fontWeight={700} fill={moved / KEYS > 0.5 ? colors.bad : colors.good}>
                movidas: {((moved / KEYS) * 100).toFixed(0)}%
              </text>
            )}
          </svg>
        </div>

        <div className="grid gap-3 content-start">
          <Segmented size="sm" value={mode} onChange={(m) => { setPrev(assign); setMode(m) }} options={[{ id: 'ring', label: 'Consistent hashing' }, { id: 'mod', label: 'hash % N' }]} />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Nodos: {nodes.length}</span>
            <span className="flex gap-1">
              <button className="btn btn-ghost !p-1.5" onClick={() => remove(nodes[nodes.length - 1])} aria-label="Quitar nodo"><Minus size={14} /></button>
              <button className="btn btn-ghost !p-1.5" onClick={add} aria-label="Agregar nodo"><Plus size={14} /></button>
            </span>
          </div>
          {mode === 'ring' && <Slider label="Nodos virtuales por servidor" min={1} max={50} value={vnodes} onChange={(v) => { setPrev(null); setVnodes(v) }} />}
          <div className="grid gap-1.5">
            {nodes.map((n, i) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: NODE_COLORS[n] }} />
                <span className="w-12 font-mono">nodo {NAMES[n]}</span>
                <div className="flex-1 h-2.5 bg-surface-2 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: NODE_COLORS[n] }} animate={{ width: `${Math.min(100, (counts[i] / (avg * 2)) * 100)}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{counts[i]}</span>
                <button className="text-muted hover:text-bad" onClick={() => remove(n)} aria-label={`Quitar nodo ${NAMES[n]}`}>×</button>
              </div>
            ))}
            <div className="text-[10px] text-muted">la mitad de cada barra = carga ideal ({avg.toFixed(0)})</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Claves movidas" value={prev ? `${((moved / KEYS) * 100).toFixed(0)}%` : '—'} sub={prev ? `ideal ≈ ${((1 / nodes.length) * 100).toFixed(0)}%` : 'agrega o quita un nodo'} />
        <Stat label="Más cargado" value={`${maxRatio.toFixed(2)}×`} color={maxRatio <= 1.25 ? colors.good : maxRatio > 1.6 ? colors.bad : colors.warn} sub="vs promedio" />
        <Stat label="Posiciones en anillo" value={mode === 'ring' ? ring.length : '—'} />
      </div>
      <p className="text-xs text-muted">Experimento: en modo <b>hash % N</b> agrega un nodo y mira cuántas claves cambian de dueño. Luego repite en modo anillo.</p>
    </div>
  )
}
