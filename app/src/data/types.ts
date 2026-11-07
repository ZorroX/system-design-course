export type DomainId =
  | 'fundamentals'
  | 'traffic'
  | 'data'
  | 'distributed'
  | 'async'
  | 'reliability'
  | 'api'
  | 'java'
  | 'leadership'

export interface Domain {
  id: DomainId
  name: string
  color: string // css var name
}

/** Bloques de contenido de una lección. Texto con **negrita** y `code` inline. */
export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'callout'; tone: 'info' | 'tip' | 'warn' | 'interview'; title?: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'tradeoff'; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  | { type: 'widget'; id: WidgetId }
  | { type: 'code'; lang: 'java' | 'python' | 'bash' | 'sql' | 'yaml'; code: string; title?: string }

export type WidgetId = 'latency-numbers' | 'scaling-compare' | 'sql-vs-nosql' | 'dns-resolution' | 'replication-lag'

export type SimulatorId =
  | 'load-balancer'
  | 'cache'
  | 'hash-ring'
  | 'rate-limiter'
  | 'circuit-breaker'
  | 'queue'
  | 'partition'
  | 'sharding'
  | 'observability'
  | 'search'
  | 'saga'
  | 'thread-pool'
  | 'jvm-terminal'
  | 'payment-timeout'
  | 'explain'

export type Question =
  | {
      kind: 'single'
      q: string
      options: string[]
      answer: number
      explain: string
    }
  | {
      kind: 'multi'
      q: string
      options: string[]
      answers: number[]
      explain: string
    }
  | {
      kind: 'order'
      q: string
      /** Items en el orden CORRECTO; la UI los baraja. */
      items: string[]
      explain: string
    }

export interface Flashcard {
  id: string
  front: string
  back: string
}

export interface CodeLab {
  title: string
  java: string
  python: string
  /** Comando para correrlo localmente */
  runJava: string
  runPython: string
  notes: string[]
}

export interface CloudMapping {
  concept: string
  aws: string
  azure: string
  gcp: string
  note?: string
}

export interface RealWorld {
  company: string
  title: string
  text: string
  url?: string
}

export interface Topic {
  id: string
  title: string
  subtitle: string
  domain: DomainId
  icon: string
  /** Temas de una ruta específica (no aparecen en el mapa general). */
  track?: 'java'
  /** posición en el mapa de habilidades (0..100) */
  pos: { x: number; y: number }
  prerequisites: string[]
  minutes: number
  blocks: Block[]
  simulator?: SimulatorId
  simIntro?: string
  code?: CodeLab
  cloud: CloudMapping[]
  realWorld: RealWorld[]
  interview: { questions: string[]; tips: string[]; redFlags: string[] }
  quiz: Question[]
  flashcards: Flashcard[]
  resources: { title: string; url: string }[]
}
