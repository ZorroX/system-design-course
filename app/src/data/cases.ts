import type { NodeKind } from '@/lab/catalog'

export interface DiagramNode {
  id: string
  label: string
  kind: NodeKind
  x: number
  y: number
}

export interface CaseStudy {
  id: string
  title: string
  emoji: string
  inspiredBy: string
  difficulty: 1 | 2 | 3
  prompt: string
  functional: string[]
  nonFunctional: string[]
  estimation: { label: string; value: string; how: string }[]
  api: { method: string; path: string; desc: string }[]
  dataModel: { entity: string; fields: string; store: string }[]
  diagram: { nodes: DiagramNode[]; edges: [string, string, string?][] }
  deepDives: { title: string; text: string }[]
  tradeoffs: { decision: string; choice: string; why: string }[]
  followUps: { q: string; a: string }[]
  cloud: { aws: string; azure: string; gcp: string }
  stackJava: string
  stackPython: string
  labChallenge?: string
  topics: string[]
}

export const CASES: CaseStudy[] = [
  {
    id: 'url-shortener', title: 'Acortador de URLs', emoji: '🔗', inspiredBy: 'bit.ly, TinyURL', difficulty: 1,
    prompt: 'Diseña un servicio que convierta URLs largas en cortas (sho.rt/abc123) y redirija a la original.',
    functional: ['Crear URL corta a partir de una larga', 'Redirigir la corta a la larga (HTTP 301/302)', 'Alias personalizados opcionales', 'Expiración opcional', 'Analítica básica de clics'],
    nonFunctional: ['Lecturas >> escrituras (100:1)', 'Redirección con latencia muy baja (p99 < 50 ms)', 'Alta disponibilidad (99.99%)', 'Las URLs cortas no deben ser predecibles'],
    estimation: [
      { label: 'Escrituras', value: '~1.200/s', how: '100 M URLs nuevas/día ÷ 10⁵ s' },
      { label: 'Lecturas', value: '~120.000/s', how: '× 100 lecturas por escritura' },
      { label: 'Almacenamiento (5 años)', value: '~90 TB', how: '100 M × 365 × 5 × ~500 B' },
      { label: 'Longitud del código', value: '7 chars', how: '62⁷ ≈ 3,5 billones de combinaciones (base62)' },
    ],
    api: [
      { method: 'POST', path: '/v1/urls', desc: '{ longUrl, alias?, expiresAt? } → 201 { shortUrl }' },
      { method: 'GET', path: '/{code}', desc: '301/302 → Location: longUrl' },
      { method: 'GET', path: '/v1/urls/{code}/stats', desc: 'Clics por día/país' },
    ],
    dataModel: [
      { entity: 'url', fields: 'code (PK), long_url, user_id, created_at, expires_at', store: 'DynamoDB/Cassandra (KV por code) o Postgres particionado' },
      { entity: 'click_event', fields: 'code, ts, country, referrer', store: 'Kafka → data warehouse (ClickHouse/BigQuery)' },
    ],
    diagram: {
      nodes: [
        { id: 'u', label: 'Usuarios', kind: 'client', x: 6, y: 50 },
        { id: 'lb', label: 'LB', kind: 'lb', x: 24, y: 50 },
        { id: 'w', label: 'Write API', kind: 'app', x: 44, y: 22 },
        { id: 'r', label: 'Redirect API', kind: 'app', x: 44, y: 78 },
        { id: 'kgs', label: 'Key Gen (rangos)', kind: 'worker', x: 66, y: 8 },
        { id: 'c', label: 'Redis', kind: 'cache', x: 66, y: 78 },
        { id: 'db', label: 'KV store', kind: 'nosql', x: 88, y: 50 },
        { id: 'q', label: 'Kafka clics', kind: 'queue', x: 66, y: 98 },
      ],
      edges: [['u', 'lb'], ['lb', 'w'], ['lb', 'r'], ['w', 'kgs', 'pide rango'], ['w', 'db'], ['r', 'c'], ['c', 'db', 'miss'], ['r', 'q', 'evento']],
    },
    deepDives: [
      { title: 'Generar el código', text: 'Opciones: (1) hash (MD5/SHA) de la URL y tomar 7 chars en base62 → colisiones que hay que detectar; (2) contador global + base62 → predecible y el contador es cuello de botella; (3) **Key Generation Service**: entrega rangos de IDs pre-asignados a cada servidor (p. ej. 1.000.000 por vez) que se codifican en base62 y se barajan. Sin colisiones ni coordinación por petición.' },
      { title: '301 vs 302', text: '301 (permanente) lo cachean navegadores: menos carga, pero pierdes analítica de clics repetidos. 302 (temporal) pasa siempre por ti: analítica completa. Muchos servicios usan 302 o 307.' },
      { title: 'Caché', text: 'Distribución muy sesgada: un pequeño % de URLs recibe la mayoría de clics. Redis con LRU y hit rate > 90%. Clave = code, valor = long_url. TTL alineado con la expiración.' },
      { title: 'Analítica sin frenar la redirección', text: 'La redirección publica un evento a Kafka de forma asíncrona (fire-and-forget con buffer). Consumidores agregan en un warehouse. Nunca escribas analítica síncrona en el camino crítico.' },
    ],
    tradeoffs: [
      { decision: 'Almacén', choice: 'KV (DynamoDB/Cassandra)', why: 'Acceso solo por clave, escala horizontal trivial; no hay joins.' },
      { decision: 'Generación de IDs', choice: 'Rangos pre-asignados', why: 'Sin colisiones ni consulta a la DB por cada creación.' },
      { decision: 'Redirección', choice: '302', why: 'Preserva analítica; la caché del servidor absorbe la carga.' },
    ],
    followUps: [
      { q: '¿Cómo evitas que alguien enumere todas las URLs?', a: 'Códigos no secuenciales (barajar el rango o usar un cifrado tipo Feistel sobre el ID), rate limiting por IP y no exponer listados.' },
      { q: '¿Qué pasa si el Key Generation Service cae?', a: 'Cada servidor tiene un rango en memoria para seguir un rato; el KGS se replica (líder con ZooKeeper/etcd) y los rangos perdidos simplemente se desperdician.' },
      { q: '¿Cómo borras URLs expiradas?', a: 'TTL nativo (DynamoDB TTL, Cassandra TTL) + verificación perezosa al leer. Un job de limpieza en horas valle si hace falta.' },
    ],
    cloud: { aws: 'Route 53 → CloudFront → ALB → ECS/Lambda → ElastiCache + DynamoDB; Kinesis/MSK → S3 + Athena', azure: 'Front Door → Container Apps → Azure Cache for Redis + Cosmos DB; Event Hubs → Data Explorer', gcp: 'Cloud LB → Cloud Run → Memorystore + Bigtable/Firestore; Pub/Sub → BigQuery' },
    stackJava: 'Spring Boot 3 (virtual threads) + Spring Data Redis + AWS SDK v2 DynamoDB Enhanced Client', stackPython: 'FastAPI + redis-py (asyncio) + boto3 / aioboto3',
    labChallenge: 'url-shortener', topics: ['caching', 'databases', 'sharding', 'api-design'],
  },
  {
    id: 'rate-limiter', title: 'Rate limiter distribuido', emoji: '🚦', inspiredBy: 'Stripe, Cloudflare, API Gateway', difficulty: 2,
    prompt: 'Diseña un rate limiter para una API pública con millones de clientes y decenas de servidores.',
    functional: ['Limitar por API key, usuario o IP', 'Reglas configurables por endpoint y plan', 'Responder 429 con Retry-After', 'Exponer headers de cuota'],
    nonFunctional: ['Sobrecarga < 2 ms por petición', 'Precisión razonable (aproximado aceptable)', 'Si el limitador falla, no tumbar la API', 'Escala a ~1 M de clientes activos'],
    estimation: [
      { label: 'Peticiones', value: '~500k RPS', how: 'Tráfico total de la API en pico' },
      { label: 'Memoria por cliente', value: '~50 B', how: 'Token bucket: tokens + timestamp' },
      { label: 'Memoria total', value: '~50 MB', how: '1 M clientes × 50 B: cabe en un nodo Redis' },
      { label: 'Ops Redis', value: '~500k/s', how: '1 por petición → clúster Redis con varios shards' },
    ],
    api: [
      { method: 'interno', path: 'allow(key, rule) → {allowed, remaining, resetAt}', desc: 'Llamado por el gateway/middleware' },
      { method: 'PUT', path: '/v1/rules/{id}', desc: 'Configura límites por plan/endpoint' },
    ],
    dataModel: [
      { entity: 'bucket', fields: 'rl:{key}:{rule} → {tokens, ts}', store: 'Redis Cluster con TTL' },
      { entity: 'rule', fields: 'id, match (endpoint, plan), capacity, refill_rate', store: 'Postgres + caché local con refresco' },
    ],
    diagram: {
      nodes: [
        { id: 'u', label: 'Clientes', kind: 'client', x: 6, y: 50 },
        { id: 'gw', label: 'API Gateway + middleware', kind: 'gateway', x: 30, y: 50 },
        { id: 'r', label: 'Redis Cluster (Lua)', kind: 'cache', x: 56, y: 18 },
        { id: 'rules', label: 'Reglas (caché local)', kind: 'sql', x: 56, y: 85 },
        { id: 'app', label: 'Servicios', kind: 'app', x: 84, y: 50 },
      ],
      edges: [['u', 'gw'], ['gw', 'r', 'EVALSHA'], ['gw', 'rules'], ['gw', 'app', 'si allowed']],
    },
    deepDives: [
      { title: 'Atomicidad', text: 'El token bucket requiere leer, calcular y escribir. Hacerlo desde la app en dos pasos tiene carreras. Un **script Lua** en Redis lo ejecuta atómicamente en un solo round trip.' },
      { title: 'Latencia', text: 'Un round trip a Redis en la misma AZ es ~0,5 ms. Para clientes muy activos, combina un contador local con sincronización periódica (aproximado pero sin round trip por petición).' },
      { title: 'Fallos', text: 'Si Redis no responde en ~5 ms: fail open (dejar pasar) con un limitador local conservador como red de seguridad. Alerta, porque estás desprotegido.' },
      { title: 'Multi-región', text: 'Límites por región (más simple, cada región con su Redis) o globales con replicación asíncrona y tolerancia a cierto exceso.' },
    ],
    tradeoffs: [
      { decision: 'Algoritmo', choice: 'Token bucket', why: 'Permite ráfagas legítimas y es O(1) en memoria.' },
      { decision: 'Ubicación', choice: 'Gateway/middleware', why: 'Corta el tráfico antes de consumir recursos de los servicios.' },
      { decision: 'Fallo del store', choice: 'Fail open', why: 'Priorizamos disponibilidad de la API sobre exactitud del límite.' },
    ],
    followUps: [
      { q: '¿Cómo evitas que el límite sea 2× en el borde de una ventana fija?', a: 'Sliding window counter (ponderando la ventana anterior) o token bucket.' },
      { q: '¿Cómo limitas peticiones concurrentes, no por segundo?', a: 'Un contador de "en vuelo" que incrementas al entrar y decrementas al terminar (con TTL por si el proceso muere).' },
    ],
    cloud: { aws: 'API Gateway usage plans o ALB + middleware → ElastiCache; WAF rate-based rules en el edge', azure: 'API Management rate-limit-by-key → Azure Cache for Redis; Front Door WAF', gcp: 'Apigee / Cloud Armor rate limiting → Memorystore' },
    stackJava: 'Bucket4j con backend Redis (Lettuce) o Resilience4j RateLimiter + Spring Cloud Gateway', stackPython: 'slowapi / limits sobre FastAPI con redis-py y scripts Lua',
    topics: ['rate-limiting', 'caching', 'api-design'],
  },
  {
    id: 'chat', title: 'Chat en tiempo real', emoji: '💬', inspiredBy: 'WhatsApp, Slack, Discord', difficulty: 3,
    prompt: 'Diseña un sistema de mensajería 1:1 y grupal con entrega en tiempo real, estado online y historial.',
    functional: ['Mensajes 1:1 y grupos (hasta 500)', 'Entrega en tiempo real y offline (push)', 'Recibos de entregado/leído', 'Presencia (online/última vez)', 'Historial sincronizado entre dispositivos'],
    nonFunctional: ['Latencia de entrega < 200 ms', 'Orden de mensajes por conversación', 'Sin pérdida de mensajes', 'Cientos de millones de conexiones concurrentes'],
    estimation: [
      { label: 'Mensajes', value: '~1,2 M/s', how: '1.000 M DAU × 100 msgs/día ÷ 10⁵' },
      { label: 'Conexiones', value: '~200 M concurrentes', how: 'Fracción de DAU conectada a la vez' },
      { label: 'Servidores WS', value: '~2.000', how: '~100k conexiones por servidor' },
      { label: 'Almacenamiento', value: '~10 TB/día', how: '100 G msgs × 100 B' },
    ],
    api: [
      { method: 'WS', path: '/v1/connect', desc: 'Conexión persistente autenticada' },
      { method: 'WS ↑', path: 'send {convId, clientMsgId, body}', desc: 'clientMsgId para idempotencia' },
      { method: 'WS ↓', path: 'message / ack / receipt / presence', desc: 'Eventos del servidor' },
      { method: 'GET', path: '/v1/conversations/{id}/messages?before=cursor', desc: 'Historial paginado' },
    ],
    dataModel: [
      { entity: 'message', fields: 'conv_id (partition), msg_id (clustering, Snowflake), sender_id, body, ts', store: 'Cassandra/ScyllaDB' },
      { entity: 'session', fields: 'user_id → gateway_server_id', store: 'Redis (TTL con heartbeats)' },
      { entity: 'conversation_member', fields: 'conv_id, user_id, last_read_msg_id', store: 'Cassandra / Postgres' },
    ],
    diagram: {
      nodes: [
        { id: 'u', label: 'Apps', kind: 'client', x: 6, y: 50 },
        { id: 'lb', label: 'LB L4', kind: 'lb', x: 22, y: 50 },
        { id: 'ws', label: 'WS Gateways', kind: 'app', x: 40, y: 50 },
        { id: 'sess', label: 'Sesiones Redis', kind: 'cache', x: 58, y: 12 },
        { id: 'chat', label: 'Chat Service', kind: 'app', x: 60, y: 50 },
        { id: 'k', label: 'Kafka (por conv_id)', kind: 'queue', x: 78, y: 30 },
        { id: 'db', label: 'ScyllaDB', kind: 'nosql', x: 92, y: 62 },
        { id: 'push', label: 'Push (APNs/FCM)', kind: 'worker', x: 78, y: 92 },
      ],
      edges: [['u', 'lb'], ['lb', 'ws'], ['ws', 'chat'], ['ws', 'sess'], ['chat', 'db', 'persistir'], ['chat', 'k', 'fan-out'], ['k', 'ws', 'entregar'], ['k', 'push', 'offline']],
    },
    deepDives: [
      { title: 'Conexiones y enrutamiento', text: 'Cada usuario mantiene un WebSocket con un gateway. Un registro de sesiones (Redis) dice en qué gateway está cada usuario. Para entregar, el chat service publica al gateway correcto (vía pub/sub o Kafka particionado por gateway).' },
      { title: 'Orden e IDs', text: 'Orden por conversación: particiona Kafka y la tabla por `conv_id`; IDs Snowflake (ordenables por tiempo) o una secuencia por conversación. El cliente envía `clientMsgId` para deduplicar reintentos.' },
      { title: 'Entrega garantizada', text: 'Persistir primero, luego entregar. El cliente confirma (ack) y el servidor marca entregado. Si está offline: notificación push y sincroniza al reconectar pidiendo "mensajes después del último msg_id que tengo".' },
      { title: 'Grupos grandes', text: 'Fan-out on write para grupos pequeños. Para canales enormes (Discord), los clientes leen del canal (fan-out on read) y solo se notifican menciones.' },
    ],
    tradeoffs: [
      { decision: 'Protocolo', choice: 'WebSocket', why: 'Bidireccional y de baja latencia; long polling como fallback.' },
      { decision: 'Almacén', choice: 'Wide-column (Scylla/Cassandra)', why: 'Escrituras masivas y lecturas por conversación ordenadas por tiempo.' },
      { decision: 'Presencia', choice: 'Heartbeats + TTL, eventual', why: 'No necesita consistencia fuerte; se propaga solo a contactos activos.' },
    ],
    followUps: [
      { q: '¿Cómo implementas cifrado extremo a extremo?', a: 'Protocolo Signal: claves en el dispositivo, el servidor solo enruta blobs cifrados. Complica búsqueda e historial multi-dispositivo (cada dispositivo tiene claves).' },
      { q: '¿Qué pasa si un gateway WS cae?', a: 'Los clientes reconectan (con backoff + jitter para evitar thundering herd) a otro gateway; la sesión se actualiza y se sincronizan los mensajes pendientes desde la DB.' },
    ],
    cloud: { aws: 'NLB → EC2/EKS (WebSocket) o API Gateway WebSocket → ElastiCache + Keyspaces/DynamoDB; MSK; SNS Mobile Push', azure: 'Web PubSub / SignalR Service → AKS → Cosmos DB + Event Hubs; Notification Hubs', gcp: 'GKE con LB L4 → Memorystore + Bigtable; Pub/Sub; Firebase Cloud Messaging' },
    stackJava: 'Spring WebFlux / Netty con WebSocket, spring-kafka, DataStax Java Driver', stackPython: 'FastAPI/Starlette WebSockets con uvicorn, aiokafka, scylla/cassandra-driver',
    labChallenge: 'chat', topics: ['messaging', 'databases', 'networking', 'sharding'],
  },
  {
    id: 'news-feed', title: 'News feed / timeline', emoji: '📰', inspiredBy: 'Twitter/X, Instagram, Facebook', difficulty: 3,
    prompt: 'Diseña el timeline de inicio: los usuarios publican y ven las publicaciones de quienes siguen.',
    functional: ['Publicar posts (texto, imagen)', 'Seguir usuarios', 'Ver timeline de inicio paginado', 'Likes y contadores'],
    nonFunctional: ['Timeline en < 200 ms', 'Consistencia eventual aceptable (segundos)', 'Usuarios con 100 M de seguidores', 'Altísimo ratio lectura/escritura'],
    estimation: [
      { label: 'Posts', value: '~6k/s', how: '300 M DAU × 2 posts/día ÷ 10⁵' },
      { label: 'Lecturas de timeline', value: '~300k/s', how: '300 M × 100 vistas/día ÷ 10⁵' },
      { label: 'Fan-out', value: '~1,2 M escrituras/s', how: '6k posts × 200 seguidores promedio' },
      { label: 'Caché de timelines', value: '~2,4 TB', how: '300 M × 800 IDs × 8 B' },
    ],
    api: [
      { method: 'POST', path: '/v1/posts', desc: 'Crear post (Idempotency-Key)' },
      { method: 'GET', path: '/v1/timeline?cursor=', desc: 'Timeline de inicio paginado por cursor' },
      { method: 'POST', path: '/v1/users/{id}/follow', desc: 'Seguir' },
    ],
    dataModel: [
      { entity: 'post', fields: 'post_id (Snowflake), author_id, body, media_url, ts', store: 'Sharded por author_id (Postgres/Cassandra)' },
      { entity: 'follow', fields: 'follower_id, followee_id', store: 'Grafo / tabla sharded en ambas direcciones' },
      { entity: 'timeline', fields: 'user_id → [post_id...] (últimos ~800)', store: 'Redis (listas/sorted sets)' },
    ],
    diagram: {
      nodes: [
        { id: 'u', label: 'Usuarios', kind: 'client', x: 6, y: 50 },
        { id: 'lb', label: 'LB', kind: 'lb', x: 20, y: 50 },
        { id: 'post', label: 'Post Service', kind: 'app', x: 38, y: 20 },
        { id: 'tl', label: 'Timeline Service', kind: 'app', x: 38, y: 80 },
        { id: 'q', label: 'Kafka posts', kind: 'queue', x: 58, y: 20 },
        { id: 'fan', label: 'Fan-out workers', kind: 'worker', x: 76, y: 20 },
        { id: 'tc', label: 'Timeline cache', kind: 'cache', x: 66, y: 80 },
        { id: 'db', label: 'Posts DB', kind: 'nosql', x: 92, y: 55 },
        { id: 's3', label: 'Media (S3+CDN)', kind: 'storage', x: 38, y: 100 },
      ],
      edges: [['u', 'lb'], ['lb', 'post'], ['lb', 'tl'], ['post', 'db'], ['post', 'q'], ['q', 'fan'], ['fan', 'tc', 'push IDs'], ['tl', 'tc'], ['tl', 'db', 'hidratar'], ['u', 's3']],
    },
    deepDives: [
      { title: 'Fan-out on write vs on read', text: '**Push (on write)**: al publicar, se inserta el ID en el timeline cacheado de cada seguidor. Lectura O(1), pero un usuario con 100 M de seguidores genera 100 M escrituras. **Pull (on read)**: al leer, se combinan los posts recientes de todos los seguidos. Sin amplificación de escritura, lectura costosa. **Híbrido**: push para usuarios normales, pull para celebridades, y se mezclan al leer.' },
      { title: 'Hidratación', text: 'El timeline guarda solo IDs. Al leer, se obtienen los posts (multi-get con caché de posts) y los datos de autor. Así un post editado se ve actualizado en todos los timelines.' },
      { title: 'Ranking', text: 'Timeline cronológico vs ranqueado (ML): el ranqueado obtiene candidatos (IDs recientes de seguidos + recomendaciones) y los puntúa con un modelo. Separar candidate generation de ranking.' },
      { title: 'Contadores de likes', text: 'Escrituras masivas sobre la misma clave: contadores en Redis con agregación por lotes a la DB, o contadores sharded (post#0..N).' },
    ],
    tradeoffs: [
      { decision: 'Fan-out', choice: 'Híbrido push/pull', why: 'Evita la amplificación de escritura de celebridades sin hacer lenta la lectura común.' },
      { decision: 'Consistencia', choice: 'Eventual', why: 'Ver un post 3 s tarde es aceptable; la latencia de lectura no.' },
      { decision: 'Timeline', choice: 'Solo IDs en caché', why: 'Memoria acotada y posts siempre actualizados.' },
    ],
    followUps: [
      { q: '¿Qué haces con usuarios inactivos?', a: 'No precomputar su timeline (ahorra memoria); se reconstruye por pull la próxima vez que entren.' },
      { q: '¿Cómo manejas el borrado de un post?', a: 'Tombstone en la DB; la hidratación lo filtra. Opcionalmente un job limpia los IDs en las cachés.' },
    ],
    cloud: { aws: 'CloudFront + S3 (media) → ALB → EKS → ElastiCache + DynamoDB/Aurora; MSK; Personalize/SageMaker para ranking', azure: 'Front Door + Blob → AKS → Azure Cache for Redis + Cosmos DB; Event Hubs; Azure ML', gcp: 'Cloud CDN + GCS → GKE → Memorystore + Bigtable/Spanner; Pub/Sub; Vertex AI' },
    stackJava: 'Spring Boot + Lettuce (Redis pipelining) + spring-kafka; Java 21 virtual threads para la hidratación concurrente', stackPython: 'FastAPI + redis-py asyncio + confluent-kafka; asyncio.gather para hidratar en paralelo',
    labChallenge: 'ecommerce', topics: ['caching', 'messaging', 'sharding', 'databases'],
  },
  {
    id: 'video', title: 'Streaming de video', emoji: '🎬', inspiredBy: 'YouTube, Netflix', difficulty: 3,
    prompt: 'Diseña una plataforma donde los creadores suben videos y millones de usuarios los ven en streaming.',
    functional: ['Subir videos (hasta varios GB)', 'Transcodificar a múltiples resoluciones', 'Reproducir con calidad adaptativa', 'Metadatos, búsqueda, likes, vistas'],
    nonFunctional: ['Arranque de reproducción < 2 s', 'Sin rebuffering', 'Subidas reanudables', 'Costo de egress controlado'],
    estimation: [
      { label: 'Subidas', value: '~500 h de video/min', how: 'Escala tipo YouTube' },
      { label: 'Almacenamiento', value: '~1 PB/día', how: '720k h/día × ~1,5 GB/h en varias resoluciones' },
      { label: 'Egress', value: 'Tbps', how: 'Millones de streams × ~5 Mbps → solo viable con CDN' },
    ],
    api: [
      { method: 'POST', path: '/v1/uploads', desc: 'Inicia subida → URL pre-firmada multipart' },
      { method: 'GET', path: '/v1/videos/{id}', desc: 'Metadatos + URL del manifiesto HLS/DASH' },
      { method: 'GET', path: 'cdn/{id}/{res}/seg_{n}.m4s', desc: 'Segmentos de video desde la CDN' },
    ],
    dataModel: [
      { entity: 'video', fields: 'id, owner_id, title, status, durations, renditions', store: 'Postgres/MySQL sharded (Vitess)' },
      { entity: 'segments', fields: 'objetos {id}/{res}/seg_n', store: 'Object storage + CDN' },
      { entity: 'view_counts', fields: 'video_id, count', store: 'Contadores en Redis/Bigtable agregados por stream' },
    ],
    diagram: {
      nodes: [
        { id: 'cr', label: 'Creadores', kind: 'client', x: 6, y: 18 },
        { id: 'v', label: 'Espectadores', kind: 'client', x: 6, y: 82 },
        { id: 'up', label: 'Upload API', kind: 'app', x: 28, y: 18 },
        { id: 'raw', label: 'S3 raw', kind: 'storage', x: 48, y: 4 },
        { id: 'q', label: 'Cola transcode', kind: 'queue', x: 48, y: 36 },
        { id: 'tx', label: 'Transcoders (GPU)', kind: 'worker', x: 70, y: 20 },
        { id: 'out', label: 'S3 segmentos', kind: 'storage', x: 90, y: 40 },
        { id: 'cdn', label: 'CDN', kind: 'cdn', x: 48, y: 82 },
        { id: 'meta', label: 'Metadata API', kind: 'app', x: 70, y: 70 },
        { id: 'db', label: 'Metadata DB', kind: 'sql', x: 90, y: 92 },
      ],
      edges: [['cr', 'up'], ['up', 'raw', 'URL pre-firmada'], ['up', 'q'], ['q', 'tx'], ['tx', 'out'], ['v', 'cdn'], ['cdn', 'out', 'miss'], ['v', 'meta'], ['meta', 'db']],
    },
    deepDives: [
      { title: 'Subida', text: 'El cliente sube directo a object storage con **URLs pre-firmadas** y multipart upload (reanudable, en paralelo). Tus servidores nunca tocan los bytes.' },
      { title: 'Transcodificación', text: 'Un DAG de trabajos: dividir el video en chunks → transcodificar cada chunk en paralelo a 240p…4K (H.264/VP9/AV1) → empaquetar en HLS/DASH → miniaturas. Cola + workers con GPU/autoscaling.' },
      { title: 'Adaptive bitrate', text: 'El reproductor descarga un manifiesto con todas las calidades y elige segmento a segmento según el ancho de banda medido. Así evita rebuffering.' },
      { title: 'CDN y costos', text: 'El egress es el mayor costo. Contenido popular pre-posicionado en el edge (Netflix Open Connect dentro de los ISPs); la cola larga se sirve bajo demanda desde el origen.' },
    ],
    tradeoffs: [
      { decision: 'Bytes de video', choice: 'Nunca pasan por la app', why: 'URLs pre-firmadas y CDN: la app solo gestiona metadatos.' },
      { decision: 'Transcodificación', choice: 'Asíncrona por chunks', why: 'Paraleliza horas de video en minutos y reintenta solo el chunk fallido.' },
      { decision: 'Contador de vistas', choice: 'Eventual y agregado', why: 'Precisión exacta en tiempo real no vale el costo.' },
    ],
    followUps: [
      { q: '¿Cómo detectas una vista "real"?', a: 'Eventos del reproductor (≥ X segundos), deduplicación por sesión, filtros anti-bots en el pipeline de streaming antes de agregar.' },
      { q: '¿Cómo reduces costos de almacenamiento?', a: 'Lifecycle policies: videos poco vistos pasan a clases frías (S3 IA/Glacier) y se eliminan resoluciones raramente pedidas.' },
    ],
    cloud: { aws: 'S3 + MediaConvert / Elemental + CloudFront; SQS + Batch/ECS GPU; DynamoDB/Aurora para metadatos', azure: 'Blob Storage + Front Door; Batch con GPU + Service Bus (Azure Media Services fue retirado: usa partners o FFmpeg propio)', gcp: 'Cloud Storage + Transcoder API + Media CDN; Pub/Sub + GKE GPU; Spanner/Cloud SQL' },
    stackJava: 'Spring Boot para APIs + AWS SDK v2 presigner; workers con FFmpeg invocado desde Java', stackPython: 'FastAPI + boto3 generate_presigned_url; workers Celery/Ray orquestando FFmpeg',
    labChallenge: 'video', topics: ['networking', 'messaging', 'caching', 'scalability'],
  },
  {
    id: 'ride-sharing', title: 'Ride sharing', emoji: '🚗', inspiredBy: 'Uber, Lyft, DiDi', difficulty: 3,
    prompt: 'Diseña el emparejamiento de pasajeros con conductores cercanos en tiempo real.',
    functional: ['Conductores envían ubicación cada ~4 s', 'Pasajero pide viaje y ve conductores cercanos', 'Emparejar con un conductor', 'Seguimiento del viaje en vivo', 'Pago al finalizar'],
    nonFunctional: ['Emparejamiento < 1 s', 'Alta tasa de actualizaciones de ubicación', 'Un conductor no puede tener dos viajes', 'Disponibilidad por región'],
    estimation: [
      { label: 'Conductores activos', value: '~5 M', how: 'Escala global' },
      { label: 'Updates de ubicación', value: '~1,25 M/s', how: '5 M ÷ 4 s' },
      { label: 'Viajes', value: '~300/s', how: '25 M viajes/día ÷ 10⁵' },
    ],
    api: [
      { method: 'WS/UDP', path: 'driver location {lat, lng, ts}', desc: 'Stream de ubicación' },
      { method: 'POST', path: '/v1/rides', desc: 'Pedir viaje (Idempotency-Key)' },
      { method: 'WS', path: 'ride updates', desc: 'Conductor asignado, ETA, ubicación' },
    ],
    dataModel: [
      { entity: 'driver_location', fields: 'driver_id, cell_id (H3/geohash), lat, lng, ts', store: 'En memoria (Redis GEO / servicio propio) sharded por celda' },
      { entity: 'ride', fields: 'ride_id, rider, driver, state, route', store: 'Postgres/Schemaless con máquina de estados' },
    ],
    diagram: {
      nodes: [
        { id: 'd', label: 'Conductores', kind: 'client', x: 6, y: 20 },
        { id: 'p', label: 'Pasajeros', kind: 'client', x: 6, y: 80 },
        { id: 'gw', label: 'Gateway', kind: 'gateway', x: 24, y: 50 },
        { id: 'loc', label: 'Location Service', kind: 'app', x: 46, y: 20 },
        { id: 'geo', label: 'Índice geo (H3)', kind: 'cache', x: 70, y: 20 },
        { id: 'match', label: 'Matching', kind: 'app', x: 46, y: 80 },
        { id: 'k', label: 'Kafka', kind: 'queue', x: 70, y: 52 },
        { id: 'db', label: 'Rides DB', kind: 'sql', x: 92, y: 80 },
      ],
      edges: [['d', 'gw'], ['p', 'gw'], ['gw', 'loc'], ['gw', 'match'], ['loc', 'geo'], ['loc', 'k', 'stream'], ['match', 'geo', 'cercanos'], ['match', 'db', 'tx']],
    },
    deepDives: [
      { title: 'Índice geoespacial', text: 'Divide el mapa en celdas (geohash, quadtree o **H3** hexagonal de Uber). La ubicación del conductor actualiza su celda en memoria. "Cercanos" = celda del pasajero + anillo de celdas vecinas, luego distancia/ETA real.' },
      { title: 'Escala de escrituras', text: '1 M+ updates/s no van a una DB transaccional: viven en memoria sharded por región/celda, con el stream a Kafka para analítica e historial.' },
      { title: 'Emparejamiento consistente', text: 'Reservar el conductor debe ser atómico (compare-and-set sobre su estado, o lock con TTL) para no asignarlo dos veces. El viaje es una máquina de estados persistida.' },
    ],
    tradeoffs: [
      { decision: 'Ubicaciones', choice: 'En memoria, sharded por celda', why: 'Datos efímeros de altísima frecuencia; perder unos segundos es aceptable.' },
      { decision: 'Asignación', choice: 'Consistencia fuerte local', why: 'Doble asignación es inaceptable; el resto puede ser eventual.' },
    ],
    followUps: [
      { q: '¿Cómo manejas una celda muy densa (estadio tras un concierto)?', a: 'Celdas de resolución adaptativa (dividir celdas calientes) y shards dedicados para zonas calientes.' },
      { q: '¿Qué pasa si se cae una región?', a: 'Los viajes en curso se reconstruyen desde el estado replicado/teléfonos; Uber usa los propios dispositivos como respaldo del estado del viaje.' },
    ],
    cloud: { aws: 'API Gateway WebSocket/NLB → EKS → ElastiCache (GEO) + MSK + Aurora; Location Service', azure: 'Front Door → AKS → Azure Cache for Redis + Event Hubs + Azure SQL; Azure Maps', gcp: 'Cloud LB → GKE → Memorystore + Pub/Sub + Spanner; Google Maps Platform' },
    stackJava: 'Spring Boot + Uber H3-java + Redis GEO (Lettuce) + Kafka Streams', stackPython: 'FastAPI + h3-py + redis-py GEOSEARCH + Faust/Kafka',
    topics: ['sharding', 'messaging', 'replication-cap', 'caching'],
  },
  {
    id: 'payment-gateway', title: 'Pasarela de pagos', emoji: '💳', inspiredBy: 'Stripe, Adyen, Mercado Pago, Clip', difficulty: 3,
    prompt: 'Diseña la plataforma que procesa los pagos con tarjeta de miles de comercios: recibe el cobro, lo envía al adquirente, acredita al comercio y concilia. Cada caída o cobro duplicado cuesta dinero real.',
    functional: ['Crear un cobro (autorizar y capturar) con idempotencia', 'Reembolsos totales y parciales', 'Consultar el estado de un pago', 'Webhooks al comercio con los cambios de estado', 'Liquidar a los comercios y conciliar con el adquirente'],
    nonFunctional: ['Nunca cobrar dos veces ni perder un pago (consistencia financiera)', 'Disponibilidad 99,99% en la ruta de cobro', 'p99 < 800 ms (dominado por el adquirente)', '~2.000 TPS sostenidos, picos de 10.000 en quincena / Buen Fin', 'Auditoría completa e inmutable; PCI DSS'],
    estimation: [
      { label: 'Cobros', value: '~2.000 TPS (pico 10k)', how: '150 M de pagos/día ÷ 10⁵ s ≈ 1.700/s, ×5 en pico' },
      { label: 'Escrituras de ledger', value: '~8.000 asientos/s', how: '2 asientos por movimiento × autorización + captura' },
      { label: 'Almacenamiento', value: '~110 TB en 5 años', how: '150 M/día × ~400 B (pago + asientos + eventos) × 365 × 5' },
      { label: 'Llamadas en vuelo al adquirente', value: '~1.600', how: 'Ley de Little: 2.000 TPS × 0,8 s de latencia del adquirente (repartidas en la flota)' },
    ],
    api: [
      { method: 'POST', path: '/v1/payments  (Idempotency-Key)', desc: '{ amount_cents, currency, merchant_id, card_token, capture } → 201 { id, status }' },
      { method: 'POST', path: '/v1/payments/{id}/capture', desc: 'Captura una autorización (idempotente)' },
      { method: 'POST', path: '/v1/payments/{id}/refunds  (Idempotency-Key)', desc: 'Reembolso total o parcial' },
      { method: 'GET', path: '/v1/payments/{id}', desc: 'Estado actual: PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED' },
      { method: 'webhook', path: 'POST {url del comercio}', desc: 'payment.captured, refund.succeeded… firmados (HMAC) y con reintentos' },
    ],
    dataModel: [
      { entity: 'payment', fields: 'id, merchant_id, amount_cents, currency, status, acquirer_ref, version, created_at', store: 'PostgreSQL particionado por merchant_id (Citus/Aurora), réplica síncrona' },
      { entity: 'idempotency_key', fields: '(merchant_id, key) PK, request_hash, status, response, created_at (TTL 24 h)', store: 'Misma base, misma transacción que payment' },
      { entity: 'ledger_entry', fields: 'id, tx_id, account_id, amount_cents (±), created_at (append-only)', store: 'PostgreSQL append-only; saldos materializados' },
      { entity: 'outbox', fields: 'id, aggregate_id, type, payload, published_at', store: 'Misma base → Debezium → Kafka' },
    ],
    diagram: {
      nodes: [
        { id: 'm', label: 'Comercios / apps', kind: 'client', x: 5, y: 50 },
        { id: 'gw', label: 'API Gateway (auth, rate limit por comercio)', kind: 'gateway', x: 22, y: 50 },
        { id: 'pay', label: 'Payments API (idempotencia, estados)', kind: 'app', x: 42, y: 30 },
        { id: 'risk', label: 'Antifraude', kind: 'app', x: 42, y: 78 },
        { id: 'db', label: 'PostgreSQL (pagos + ledger + outbox)', kind: 'sql', x: 64, y: 30 },
        { id: 'acq', label: 'Conector adquirente (bulkhead + breaker)', kind: 'app', x: 64, y: 78 },
        { id: 'k', label: 'Kafka (eventos)', kind: 'queue', x: 82, y: 30 },
        { id: 'wh', label: 'Webhooks + conciliación', kind: 'worker', x: 95, y: 60 },
      ],
      edges: [['m', 'gw'], ['gw', 'pay'], ['pay', 'risk', 'evaluar'], ['pay', 'db', 'tx: pago + clave + outbox'], ['pay', 'acq', 'cobrar (misma ref)'], ['db', 'k', 'CDC outbox'], ['k', 'wh']],
    },
    deepDives: [
      { title: 'Idempotencia de punta a punta', text: 'La Idempotency-Key se guarda con el hash del payload y UNIQUE en la misma transacción que el pago EN_CURSO. Se propaga una referencia propia al adquirente para que él también deduplique. Reintentos → respuesta guardada, 409 o 422.' },
      { title: 'Timeout con el adquirente', text: 'El pago queda PENDIENTE (no FALLIDO). Se consulta el estado con la misma referencia con backoff; los webhooks del adquirente y la conciliación T+1 contra su archivo de liquidación cierran lo que quede.' },
      { title: 'Ledger y consistencia', text: 'Montos en centavos (BIGINT). Ledger de doble partida inmutable; saldos materializados con UPDATE atómico. Eventos por transactional outbox + Debezium; consumidores idempotentes (inbox). Saga orquestada para captura → abono al comercio, con pivote en el cobro.' },
      { title: 'Resiliencia y escala', text: 'Bulkhead (pool dedicado) y circuit breaker por adquirente, con enrutamiento a un adquirente alternativo. Rate limiting por comercio en el gateway. Particionado por merchant_id. Canary con rollback automático y DR warm standby en otra región.' },
    ],
    tradeoffs: [
      { decision: 'Base de datos', choice: 'PostgreSQL (ACID) particionado', why: 'Transacciones locales para pago + clave + ledger + outbox. NoSQL complicaría la consistencia sin necesidad a 2k TPS.' },
      { decision: 'Consistencia entre servicios', choice: 'Saga orquestada + outbox', why: '2PC con el adquirente es imposible; la saga con compensaciones e idempotencia da consistencia eventual controlada.' },
      { decision: 'Ante timeout', choice: 'PENDIENTE + consulta + conciliación', why: 'Preferimos unos minutos de incertidumbre a un doble cargo.' },
      { decision: 'Kafka', choice: 'Solo para eventos asíncronos', why: 'La ruta de cobro es síncrona y simple (KISS); Kafka desacopla webhooks, conciliación y analítica.' },
    ],
    followUps: [
      { q: 'El adquirente principal empieza a responder lento. ¿Qué pasa con tu servicio?', a: 'El bulkhead limita los hilos que puede consumir; el circuit breaker abre y se enruta al adquirente alternativo o se degrada; alertas por p99 y error rate del conector.' },
      { q: '¿Cómo garantizas que el comercio recibe el webhook?', a: 'Outbox → Kafka → worker con reintentos exponenciales durante 72 h, firma HMAC, ids de evento para deduplicar del lado del comercio y endpoint para consultar el estado.' },
      { q: '¿Cómo evitas que dos réplicas procesen el mismo doble clic?', a: 'INSERT con PRIMARY KEY (merchant_id, key): la segunda falla con violación de unicidad y responde 409 o la respuesta guardada.' },
      { q: '¿Cómo cambiarías el esquema de la tabla payments sin downtime?', a: 'Expand/contract: columna nueva nullable, doble escritura, backfill por lotes, cambiar lecturas con feature flag y luego eliminar la vieja; índices con CONCURRENTLY.' },
      { q: '¿Qué métricas pondrías en el dashboard?', a: 'TPS, tasa de aprobación por adquirente, p95/p99 por etapa, pagos PENDIENTES por antigüedad, diferencias de conciliación, consumer lag y DLQ.' },
    ],
    cloud: { aws: 'API Gateway + WAF → EKS → Aurora PostgreSQL Multi-AZ + MSK + ElastiCache; Secrets Manager/KMS (PCI)', azure: 'API Management + Front Door → AKS → PostgreSQL Flexible (zona redundante) + Event Hubs; Key Vault', gcp: 'Apigee + Cloud Armor → GKE → AlloyDB/Spanner + Pub/Sub o Kafka gestionado; Cloud KMS' },
    stackJava: 'Spring Boot 3 + Resilience4j (CircuitBreaker, Bulkhead, RateLimiter) + Spring Data JPA (@Version) + Debezium + Kafka', stackPython: 'FastAPI + SQLAlchemy + tenacity/pybreaker + Debezium + confluent-kafka',
    labChallenge: 'payments',
    topics: ['payments-consistency', 'distributed-tx', 'reliability', 'sql-tuning', 'deployments'],
  },
]
