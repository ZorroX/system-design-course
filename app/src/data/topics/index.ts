import type { Domain, DomainId, Topic } from '../types'
import { scalability, estimation, networking } from './fundamentals'
import { loadBalancing, caching, apiDesign, rateLimiting } from './traffic'
import { databases, replication, consistentHashing, sharding } from './data'
import { messaging, reliability } from './async'
import { observability, search, microservices } from './ops'
import { springJvm, concurrency, troubleshooting, sqlTuning, paymentsConsistency } from './java1'
import { distributedTx, deployments, leadership } from './java2'

export const TOPICS: Topic[] = [
  scalability,
  estimation,
  caching,
  networking,
  databases,
  loadBalancing,
  apiDesign,
  replication,
  consistentHashing,
  rateLimiting,
  search,
  sharding,
  messaging,
  microservices,
  reliability,
  observability,
  // Ruta: entrevista Java backend (pagos)
  springJvm,
  concurrency,
  troubleshooting,
  sqlTuning,
  paymentsConsistency,
  distributedTx,
  deployments,
  leadership,
]

/** Temas del mapa general (sin las rutas específicas). */
export const CORE_TOPICS = TOPICS.filter((t) => !t.track)

export const topicById = (id: string) => TOPICS.find((t) => t.id === id)

export const DOMAINS: Record<DomainId, Domain> = {
  fundamentals: { id: 'fundamentals', name: 'Fundamentos', color: 'var(--accent)' },
  traffic: { id: 'traffic', name: 'Tráfico', color: 'var(--violet)' },
  data: { id: 'data', name: 'Datos', color: 'var(--good)' },
  distributed: { id: 'distributed', name: 'Distribuidos', color: 'var(--pink)' },
  async: { id: 'async', name: 'Asíncrono', color: 'var(--warn)' },
  reliability: { id: 'reliability', name: 'Resiliencia', color: 'var(--bad)' },
  api: { id: 'api', name: 'APIs', color: '#60a5fa' },
  java: { id: 'java', name: 'Java y operación', color: '#f97316' },
  leadership: { id: 'leadership', name: 'Liderazgo', color: '#eab308' },
}

export const ALL_FLASHCARDS = TOPICS.flatMap((t) => t.flashcards.map((c) => ({ ...c, topicId: t.id })))
