import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { ChallengeBanner, Segmented, Stat } from '@/components/ui'
import { useColors } from '@/lib/hooks'
import { hash01, rng } from '@/lib/random'
import type { SimProps } from './index'

type Key = 'user' | 'country' | 'month' | 'order'
const SHARDS = 4
const COUNTRIES = ['US', 'US', 'US', 'US', 'BR', 'BR', 'MX', 'ES', 'AR', 'CO']

interface Order { id: number; user: number; country: string; month: number }

function makeOrders(celebrity: boolean): Order[] {
  const r = rng(11)
  return Array.from({ length: 2000 }, (_, id) => {
    const isCeleb = celebrity && r() < 0.3
    const user = isCeleb ? 7 : 1 + Math.floor(r() * 500)
    // meses recientes con más pedidos (crecimiento)
    const month = Math.min(11, Math.floor(Math.pow(r(), 0.45) * 12))
    return { id, user, country: COUNTRIES[Math.floor(r() * COUNTRIES.length)], month }
  })
}

function shardOf(o: Order, key: Key, salt: boolean): number {
  switch (key) {
    case 'user':
      // key splitting: la hot key se reparte como user7#0..3 entre todos los shards
      if (salt && o.user === 7) return o.id % SHARDS
      return Math.floor(hash01(`u${o.user}`) * SHARDS)
    case 'order':
      return Math.floor(hash01(`o${o.id}`) * SHARDS)
    case 'country':
      return Math.floor(hash01(`c${o.country}`) * SHARDS)
    case 'month':
      return Math.min(SHARDS - 1, Math.floor(o.month / 3)) // rangos: T1..T4
  }
}

const QUERIES: { id: string; label: string; freq: string; needs: Key[] }[] = [
  { id: 'byUser', label: 'Pedidos de un usuario ("Mis pedidos")', freq: '80% del tráfico', needs: ['user'] },
  { id: 'byId', label: 'Pedido por ID', freq: '15%', needs: ['order'] },
  { id: 'recent', label: 'Pedidos del último trimestre (admin)', freq: '5%', needs: ['month'] },
]

export default function ShardingSim({ done, onComplete }: SimProps) {
  const colors = useColors()
  const [key, setKey] = useState<Key>('month')
  const [celebrity, setCelebrity] = useState(false)
  const [salt, setSalt] = useState(false)

  const orders = useMemo(() => makeOrders(celebrity), [celebrity])
  const counts = useMemo(() => {
    const c = new Array(SHARDS).fill(0)
    for (const o of orders) c[shardOf(o, key, salt)]++
    return c
  }, [orders, key, salt])
  const avg = orders.length / SHARDS
  const imbalance = Math.max(...counts) / avg

  const shardsTouched = (q: (typeof QUERIES)[number]) => {
    if (q.id === 'byUser') {
      if (key !== 'user') return SHARDS
      return 1
    }
    if (q.id === 'byId') return key === 'order' ? 1 : key === 'user' ? 1 : SHARDS // con user_id en el ID (estilo Instagram)
    if (q.id === 'recent') return key === 'month' ? 1 : SHARDS
    return SHARDS
  }
  const celebQuery = key === 'user' && salt && celebrity ? SHARDS : 1

  useEffect(() => {
    if (!done && celebrity && imbalance <= 1.3 && key === 'user') onComplete()
  }, [done, celebrity, imbalance, key, onComplete])

  return (
    <div className="grid gap-4">
      <ChallengeBanner title="La clave correcta (incluso con celebridades)" done={done}>
        Activa la <b>celebridad</b> (un comerciante con el 30% de los pedidos). Elige una clave donde la consulta principal toque <b>1 shard</b> y el shard más cargado no supere <b>1.3×</b> el promedio.
      </ChallengeBanner>

      <div className="grid lg:grid-cols-[1fr_17rem] gap-4">
        <div className="card p-4 bg-grid">
          <div className="grid grid-cols-4 gap-3 items-end h-48">
            {counts.map((c, i) => {
              const ratio = c / avg
              const col = ratio > 1.6 ? colors.bad : ratio > 1.3 ? colors.warn : colors.good
              return (
                <div key={i} className="flex flex-col items-center justify-end h-full">
                  <div className="text-xs font-mono mb-1 tabular-nums">{c}</div>
                  <div className="relative w-full max-w-20 flex-1 flex items-end">
                    <motion.div className="w-full rounded-t-xl rounded-b-md border-2" style={{ borderColor: col, background: `${col}33` }} animate={{ height: `${Math.min(100, (c / (avg * 2.2)) * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} />
                    <div className="absolute left-0 right-0 border-t border-dashed" style={{ bottom: `${(avg / (avg * 2.2)) * 100}%`, borderColor: colors.muted }} />
                  </div>
                  <div className="text-xs mt-1 font-semibold">🗄️ shard {i}</div>
                </div>
              )
            })}
          </div>
          <div className="text-[11px] text-muted mt-2">Línea discontinua = carga ideal ({avg.toFixed(0)} filas). 2.000 pedidos de 500 usuarios en 10 países durante 12 meses (con crecimiento).</div>
        </div>
        <div className="grid gap-3 content-start">
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Clave de partición</div>
            <Segmented size="sm" value={key} onChange={setKey} options={[{ id: 'month', label: 'created_at (rango)' }, { id: 'country', label: 'country' }, { id: 'order', label: 'hash(order_id)' }, { id: 'user', label: 'hash(user_id)' }]} />
          </div>
          <label className="text-xs flex items-center gap-2 text-muted">
            <input type="checkbox" checked={celebrity} onChange={(e) => setCelebrity(e.target.checked)} /> ⭐ Celebridad: el usuario 7 hace el 30% de los pedidos
          </label>
          <label className={`text-xs flex items-center gap-2 ${key === 'user' && celebrity ? 'text-muted' : 'text-muted/40'}`}>
            <input type="checkbox" disabled={!(key === 'user' && celebrity)} checked={salt} onChange={(e) => setSalt(e.target.checked)} /> 🧂 Key splitting para la hot key (user7#0..3)
          </label>
        </div>
      </div>

      <div className="card p-3">
        <div className="text-xs font-semibold text-muted mb-2">Costo de las consultas</div>
        <div className="grid gap-2">
          {QUERIES.map((q) => {
            const n = shardsTouched(q)
            return (
              <div key={q.id} className="flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="truncate">{q.label}</div>
                  <div className="text-[11px] text-muted">{q.freq}</div>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: SHARDS }).map((_, i) => (
                    <motion.div key={i} animate={{ opacity: i < n ? 1 : 0.2, scale: i < n ? 1 : 0.85 }} className="w-5 h-6 rounded" style={{ background: n === 1 ? colors.good : colors.warn }} />
                  ))}
                </div>
                <span className={`text-xs font-mono w-24 text-right ${n === 1 ? 'text-good' : 'text-warn'}`}>{n === 1 ? 'single-shard' : 'scatter-gather'}</span>
              </div>
            )
          })}
          {key === 'user' && salt && celebrity && <div className="text-[11px] text-warn">Trade-off: "pedidos de la celebridad" ahora consulta {celebQuery} shards, pero solo para esa clave caliente.</div>}
          {key === 'user' && <div className="text-[11px] text-muted">"Pedido por ID" es single-shard porque el ID embebe el shard del usuario (como los IDs de Instagram).</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Desbalance" value={`${imbalance.toFixed(2)}×`} color={imbalance <= 1.3 ? colors.good : imbalance > 1.6 ? colors.bad : colors.warn} sub="shard máx / promedio" />
        <Stat label="Consulta principal" value={shardsTouched(QUERIES[0]) === 1 ? '1 shard' : `${SHARDS} shards`} color={shardsTouched(QUERIES[0]) === 1 ? colors.good : colors.warn} />
        <Stat label="Cardinalidad" value={key === 'country' ? '6' : key === 'month' ? '12' : key === 'user' ? '500' : '2.000'} sub="valores distintos" />
      </div>
    </div>
  )
}
