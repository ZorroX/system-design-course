export type NodeKind =
  | 'client'
  | 'cdn'
  | 'lb'
  | 'gateway'
  | 'app'
  | 'cache'
  | 'sql'
  | 'replica'
  | 'nosql'
  | 'queue'
  | 'worker'
  | 'storage'

export interface Spec {
  kind: NodeKind
  label: string
  icon: string
  desc: string
  /** capacidad por instancia (peticiones/s). Para DBs: lecturas */
  cap: number
  /** capacidad de escritura por instancia (solo DBs) */
  writeCap?: number
  latency: number // ms base
  cost: number // USD/mes por instancia
  availability: number // por instancia
  min: number
  max: number
  /** si cae, ¿falla la petición del usuario? */
  critical: boolean
  /** nota sobre qué significa "count" */
  countLabel?: string
  examples: { aws: string; azure: string; gcp: string }
}

export const CATALOG: Record<NodeKind, Spec> = {
  client: { kind: 'client', label: 'Usuarios', icon: '👥', desc: 'Origen del tráfico.', cap: Infinity, latency: 0, cost: 0, availability: 1, min: 1, max: 1, critical: false, examples: { aws: '—', azure: '—', gcp: '—' } },
  cdn: { kind: 'cdn', label: 'CDN', icon: '🌍', desc: 'Sirve contenido estático desde el edge (95% hit). Puede hacer proxy del resto al origen.', cap: 200_000, latency: 10, cost: 250, availability: 0.9999, min: 1, max: 1, critical: false, examples: { aws: 'CloudFront', azure: 'Front Door', gcp: 'Cloud CDN' } },
  lb: { kind: 'lb', label: 'Load Balancer', icon: '⚖️', desc: 'Reparte el tráfico entre sus destinos. ×2 = par redundante.', cap: 50_000, latency: 1, cost: 25, availability: 0.999, min: 1, max: 2, critical: true, examples: { aws: 'ALB', azure: 'Application Gateway', gcp: 'Cloud Load Balancing' } },
  gateway: { kind: 'gateway', label: 'API Gateway', icon: '🚪', desc: 'Auth, rate limiting y enrutamiento. Más caro y con menos capacidad que un LB.', cap: 15_000, latency: 4, cost: 120, availability: 0.999, min: 1, max: 4, critical: true, examples: { aws: 'API Gateway', azure: 'API Management', gcp: 'Apigee / API Gateway' } },
  app: { kind: 'app', label: 'App Server', icon: '🖥️', desc: 'Servicio stateless (Spring Boot / FastAPI). ~1.000 RPS por instancia.', cap: 1_000, latency: 15, cost: 80, availability: 0.995, min: 1, max: 60, critical: true, countLabel: 'instancias', examples: { aws: 'ECS/EKS/EC2', azure: 'AKS / Container Apps', gcp: 'GKE / Cloud Run' } },
  cache: { kind: 'cache', label: 'Cache (Redis)', icon: '⚡', desc: 'Atiende lecturas desde RAM. Hit rate según el reto. Si cae, se va a la DB (no crítico).', cap: 80_000, latency: 1, cost: 150, availability: 0.999, min: 1, max: 6, critical: false, countLabel: 'nodos', examples: { aws: 'ElastiCache', azure: 'Azure Cache for Redis', gcp: 'Memorystore' } },
  sql: { kind: 'sql', label: 'SQL Primary', icon: '🐘', desc: 'Postgres/MySQL. Transacciones ACID. ×2 = standby síncrono (más disponibilidad, no más capacidad).', cap: 5_000, writeCap: 3_000, latency: 8, cost: 350, availability: 0.995, min: 1, max: 2, critical: true, countLabel: 'primary + standby', examples: { aws: 'RDS / Aurora', azure: 'Azure Database for PostgreSQL', gcp: 'Cloud SQL / AlloyDB' } },
  replica: { kind: 'replica', label: 'Read Replica', icon: '📖', desc: 'Copia de solo lectura del SQL primario. Si existe, las lecturas van a las réplicas.', cap: 5_000, latency: 8, cost: 250, availability: 0.995, min: 1, max: 10, critical: false, countLabel: 'réplicas', examples: { aws: 'RDS Read Replica', azure: 'Read replica', gcp: 'Cloud SQL replica' } },
  nosql: { kind: 'nosql', label: 'NoSQL', icon: '🗃️', desc: 'Wide-column / clave-valor. Escala escrituras horizontalmente.', cap: 8_000, writeCap: 5_000, latency: 5, cost: 300, availability: 0.995, min: 1, max: 20, critical: true, countLabel: 'nodos', examples: { aws: 'DynamoDB / Keyspaces', azure: 'Cosmos DB', gcp: 'Bigtable / Firestore' } },
  queue: { kind: 'queue', label: 'Message Queue', icon: '📨', desc: 'Acepta escrituras asíncronas y aplana picos (la DB ve ~70% del pico).', cap: 100_000, latency: 4, cost: 120, availability: 0.99995, min: 1, max: 1, critical: true, examples: { aws: 'SQS / MSK', azure: 'Service Bus / Event Hubs', gcp: 'Pub/Sub' } },
  worker: { kind: 'worker', label: 'Workers', icon: '⚙️', desc: 'Consumen la cola. ~500 mensajes/s por instancia.', cap: 500, latency: 20, cost: 60, availability: 0.995, min: 1, max: 60, critical: false, countLabel: 'instancias', examples: { aws: 'ECS / Lambda', azure: 'Functions / Container Apps Jobs', gcp: 'Cloud Run jobs' } },
  storage: { kind: 'storage', label: 'Object Storage', icon: '🪣', desc: 'Imágenes, video, archivos. Capacidad prácticamente ilimitada.', cap: 1_000_000, latency: 25, cost: 100, availability: 0.9999, min: 1, max: 1, critical: true, examples: { aws: 'S3', azure: 'Blob Storage', gcp: 'Cloud Storage' } },
}

export const PALETTE: NodeKind[] = ['cdn', 'lb', 'gateway', 'app', 'cache', 'sql', 'replica', 'nosql', 'queue', 'worker', 'storage']

export const KIND_COLOR: Record<NodeKind, string> = {
  client: 'var(--muted)',
  cdn: 'var(--accent)',
  lb: 'var(--violet)',
  gateway: 'var(--violet)',
  app: '#60a5fa',
  cache: 'var(--warn)',
  sql: 'var(--good)',
  replica: 'var(--good)',
  nosql: 'var(--good)',
  queue: 'var(--pink)',
  worker: 'var(--pink)',
  storage: 'var(--accent)',
}
