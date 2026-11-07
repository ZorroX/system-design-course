import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { SimulatorId } from '@/data/types'

export interface SimProps {
  done: boolean
  onComplete: () => void
}

export const SIMULATORS: Record<SimulatorId, { title: string; icon: string; topic: string; Component: LazyExoticComponent<ComponentType<SimProps>> }> = {
  'load-balancer': { title: 'Load Balancer Arena', icon: '⚖️', topic: 'load-balancing', Component: lazy(() => import('./LoadBalancerSim')) },
  cache: { title: 'Cache Hit Lab', icon: '⚡', topic: 'caching', Component: lazy(() => import('./CacheSim')) },
  'hash-ring': { title: 'El Anillo', icon: '💍', topic: 'consistent-hashing', Component: lazy(() => import('./HashRingSim')) },
  'rate-limiter': { title: 'Rate Limiter Gauntlet', icon: '🚦', topic: 'rate-limiting', Component: lazy(() => import('./RateLimiterSim')) },
  'circuit-breaker': { title: 'Circuit Breaker', icon: '🛡️', topic: 'reliability', Component: lazy(() => import('./CircuitBreakerSim')) },
  queue: { title: 'Kafka Lanes', icon: '📨', topic: 'messaging', Component: lazy(() => import('./QueueSim')) },
  partition: { title: 'Split Brain (CAP)', icon: '🔁', topic: 'replication-cap', Component: lazy(() => import('./PartitionSim')) },
  sharding: { title: 'Shard Key Picker', icon: '🧩', topic: 'sharding', Component: lazy(() => import('./ShardingSim')) },
  observability: { title: 'Incident Detective', icon: '🔭', topic: 'observability', Component: lazy(() => import('./ObservabilitySim')) },
  search: { title: 'Analyzer Lab', icon: '🔍', topic: 'search', Component: lazy(() => import('./SearchSim')) },
  saga: { title: 'Saga Runner', icon: '🧬', topic: 'microservices', Component: lazy(() => import('./SagaSim')) },
  'thread-pool': { title: 'Thread Pool Forge', icon: '🧵', topic: 'concurrency', Component: lazy(() => import('./ThreadPoolSim')) },
  'jvm-terminal': { title: 'Terminal de guardia', icon: '🩺', topic: 'troubleshooting', Component: lazy(() => import('./TerminalSim')) },
  'payment-timeout': { title: 'El último milisegundo', icon: '💳', topic: 'payments-consistency', Component: lazy(() => import('./PaymentTimeoutSim')) },
  explain: { title: 'Afinador de consultas', icon: '🗄️', topic: 'sql-tuning', Component: lazy(() => import('./ExplainSim')) },
}
