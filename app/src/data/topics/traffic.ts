import type { Topic } from '../types'
import { R } from '../resources'
import lbJava from '@labs/java/LoadBalancer.java?raw'
import lbPy from '@labs/python/load_balancer.py?raw'
import lruJava from '@labs/java/LruCache.java?raw'
import lruPy from '@labs/python/lru_cache.py?raw'
import rlJava from '@labs/java/RateLimiter.java?raw'
import rlPy from '@labs/python/rate_limiter.py?raw'
import idemJava from '@labs/java/Idempotency.java?raw'
import idemPy from '@labs/python/idempotency.py?raw'

export const loadBalancing: Topic = {
  id: 'load-balancing',
  title: 'Load Balancing',
  subtitle: 'L4 vs L7, algoritmos, health checks, sticky sessions',
  domain: 'traffic',
  icon: '⚖️',
  pos: { x: 50, y: 33 },
  prerequisites: ['networking'],
  minutes: 18,
  blocks: [
    { type: 'p', text: 'Un **load balancer** reparte peticiones entre varias instancias. Aporta **escalabilidad** (más instancias = más capacidad), **disponibilidad** (saca de rotación las instancias que fallan sus health checks) y un punto central para TLS, compresión y enrutamiento.' },
    { type: 'tradeoff',
      left: { title: 'Capa 4 (transporte)', items: ['Enruta por IP:puerto (TCP/UDP)', 'Muy rápido, no inspecciona contenido', 'Millones de conexiones', 'Ej.: AWS NLB, Google Maglev'] },
      right: { title: 'Capa 7 (aplicación)', items: ['Lee HTTP: path, headers, cookies', 'Enruta /api → servicio A, /img → B', 'Termina TLS, reintentos, rate limiting', 'Ej.: AWS ALB, NGINX, Envoy'] } },
    { type: 'h', text: 'Algoritmos' },
    { type: 'table', head: ['Algoritmo', 'Cómo funciona', 'Bueno cuando...'], rows: [
      ['Round robin', 'En turno: 1, 2, 3, 1, 2...', 'Peticiones homogéneas'],
      ['Weighted RR', 'Según peso (máquinas de distinto tamaño)', 'Flota heterogénea, canary 5%'],
      ['Least connections', 'Al que tenga menos conexiones activas', 'Duración de peticiones variable'],
      ['Power of two choices', '2 al azar → el menos cargado', 'Muchos balanceadores sin estado compartido'],
      ['IP hash / consistent hash', 'Mismo cliente/clave → mismo servidor', 'Afinidad de caché, sesiones'],
    ] },
    { type: 'callout', tone: 'warn', title: 'Sticky sessions', text: 'Atar un usuario a un servidor (cookie de afinidad) es un parche para apps con estado en memoria. Rompe el balanceo cuando un servidor se llena y pierdes sesiones si cae. Prefiere sesión en Redis/JWT.' },
    { type: 'h', text: 'Health checks y alta disponibilidad' },
    { type: 'list', items: [
      '**Activos**: el LB llama a `/health` cada N segundos. **Pasivos**: detecta errores en tráfico real (outlier detection).',
      'Distingue **liveness** (¿el proceso vive?) de **readiness** (¿puede recibir tráfico? DB conectada, caché caliente).',
      'El LB en sí no debe ser SPOF: par activo-pasivo con IP flotante, o servicios gestionados multi-AZ.',
      '**Connection draining**: al desplegar, deja terminar las peticiones en curso antes de sacar la instancia.',
    ] },
    { type: 'callout', tone: 'interview', text: 'Dibuja el LB pero no te quedes ahí: di qué algoritmo y por qué, cómo detecta fallos y cómo evitas que sea SPOF. Si hay WebSockets, menciona que las conexiones largas desbalancean el round robin (usa least-connections).' },
  ],
  simulator: 'load-balancer',
  simIntro: 'Envía tráfico a una flota de servidores. Prueba algoritmos, mete peticiones lentas y tumba servidores con un clic.',
  code: { title: 'Round robin, Smooth WRR, least connections y P2C', java: lbJava, python: lbPy, runJava: 'java labs/java/LoadBalancer.java', runPython: 'python labs/python/load_balancer.py',
    notes: ['Smooth WRR es el algoritmo que usa NGINX: reparte por peso sin ráfagas.', 'Power of two choices da casi el mismo resultado que least-connections con información parcial.', 'En producción no implementas esto: lo configuras en NGINX/Envoy/ALB. Pero en la entrevista te pueden pedir el código.'] },
  cloud: [
    { concept: 'LB capa 7 (HTTP)', aws: 'Application Load Balancer', azure: 'Application Gateway', gcp: 'External Application LB' },
    { concept: 'LB capa 4 (TCP/UDP)', aws: 'Network Load Balancer', azure: 'Azure Load Balancer', gcp: 'External passthrough Network LB' },
    { concept: 'LB global multi-región', aws: 'Global Accelerator + Route 53', azure: 'Front Door', gcp: 'Global external Application LB' },
    { concept: 'Service mesh / L7 interno', aws: 'VPC Lattice / App Mesh', azure: 'Istio en AKS', gcp: 'Cloud Service Mesh' },
  ],
  realWorld: [
    { company: 'Google', title: 'Maglev', text: 'Balanceador de software L4 que corre en servidores comunes. Usa una variante de consistent hashing para que los paquetes de una conexión vayan al mismo backend incluso si cambia el pool de balanceadores.' },
    { company: 'GitHub', title: 'GLB Director', text: 'Su balanceador L4 open-source diseñado para que las conexiones existentes sobrevivan a cambios en la flota de proxies (sin romper clones largos de git).' },
  ],
  interview: {
    questions: ['¿L4 o L7 para una API REST? ¿Y para un servidor de juegos UDP?', '¿Cómo evitas que el load balancer sea un punto único de fallo?', '¿Qué algoritmo usarías con WebSockets de larga duración?'],
    tips: ['Menciona health checks y draining.', 'Relaciona algoritmo ↔ tipo de carga.', 'Para HA: múltiples AZ y servicio gestionado.'],
    redFlags: ['Sticky sessions como solución por defecto.', 'Un único LB sin redundancia.'],
  },
  quiz: [
    { kind: 'single', q: 'Tus peticiones tardan entre 10 ms y 30 s (algunas exportan reportes). ¿Qué algoritmo?', options: ['Round robin', 'Least connections', 'IP hash', 'Random'], answer: 1, explain: 'Con duración variable, round robin acumula peticiones lentas en el mismo servidor. Least-connections mira la carga real.' },
    { kind: 'single', q: 'Necesitas enrutar `/api/*` a un servicio y `/static/*` a otro. ¿Qué capa?', options: ['L3', 'L4', 'L7', 'DNS'], answer: 2, explain: 'El path solo se ve leyendo HTTP: capa 7.' },
    { kind: 'multi', q: '¿Qué hace un buen health check de readiness?', options: ['Verifica dependencias críticas (DB)', 'Responde rápido y barato', 'Ejecuta una migración de base de datos', 'Saca la instancia si falla N veces seguidas'], answers: [0, 1, 3], explain: 'Nunca hagas trabajo pesado en un health check: se ejecuta miles de veces.' },
    { kind: 'single', q: '¿Por qué las sticky sessions son problemáticas?', options: ['Son más lentas en TLS', 'Desbalancean la carga y pierdes sesiones si cae el servidor', 'No funcionan con HTTP/2', 'Requieren UDP'], answer: 1, explain: 'La sesión vive en un servidor concreto: si muere, el usuario pierde su estado.' },
    { kind: 'order', q: 'Ordena el despliegue seguro de una nueva versión detrás de un LB:', items: ['Levantar instancia nueva', 'Esperar que pase el readiness check', 'Agregarla al pool del LB', 'Drenar conexiones de la instancia vieja', 'Apagar la vieja'], explain: 'Así es un rolling deploy sin downtime.' },
  ],
  flashcards: [
    { id: 'lb-1', front: 'L4 vs L7', back: 'L4: IP/puerto, rápido, sin leer contenido. L7: HTTP (path, headers), TLS, reglas, más costoso.' },
    { id: 'lb-2', front: 'Power of two choices', back: 'Elegir 2 servidores al azar y enviar al menos cargado. Casi óptimo sin estado global.' },
    { id: 'lb-3', front: 'Liveness vs readiness', back: 'Liveness: ¿reinicio el proceso? Readiness: ¿le mando tráfico?' },
    { id: 'lb-4', front: 'Connection draining', back: 'Dejar terminar peticiones en curso antes de sacar una instancia del pool.' },
  ],
  resources: [R.primer('#load-balancer', 'Load balancer'), R.karan, R.scalability],
}

export const caching: Topic = {
  id: 'caching',
  title: 'Caching',
  subtitle: 'Cache-aside, write-through, LRU/LFU, invalidación, stampedes',
  domain: 'traffic',
  icon: '⚡',
  pos: { x: 50, y: 18 },
  prerequisites: ['scalability'],
  minutes: 20,
  blocks: [
    { type: 'p', text: 'Una caché guarda resultados costosos en un almacenamiento más rápido (RAM) para servir lecturas repetidas sin tocar la fuente. Funciona porque el acceso real es **sesgado**: el 20% de los datos recibe el 80% de las lecturas (distribución de Zipf).' },
    { type: 'h', text: 'Dónde cachear' },
    { type: 'list', items: ['**Cliente/navegador** (HTTP cache)', '**CDN** (contenido estático y respuestas públicas)', '**Caché en proceso** (Caffeine en Java, `functools.lru_cache` en Python): nanosegundos, pero cada instancia tiene la suya', '**Caché distribuida** (Redis, Memcached): compartida entre instancias', '**Base de datos** (buffer pool, query cache)'] },
    { type: 'h', text: 'Estrategias de lectura/escritura' },
    { type: 'table', head: ['Patrón', 'Cómo', 'Pros / contras'], rows: [
      ['Cache-aside (lazy)', 'App lee caché; en miss lee DB y llena caché', 'Simple, solo cachea lo usado / primer acceso lento, posible dato viejo'],
      ['Read-through', 'La caché misma carga desde la DB', 'Código más limpio / necesita soporte de la librería'],
      ['Write-through', 'Escribe en caché y DB síncronamente', 'Caché siempre fresca / escrituras más lentas'],
      ['Write-behind (back)', 'Escribe en caché; la DB se actualiza async', 'Escrituras rapidísimas / riesgo de pérdida'],
      ['Write-around', 'Escribe solo en DB; la caché se llena al leer', 'Evita llenar caché con datos que no se leen'],
    ] },
    { type: 'h', text: 'Políticas de expulsión' },
    { type: 'list', items: ['**LRU**: expulsa lo usado hace más tiempo. Buena por defecto.', '**LFU**: expulsa lo menos usado. Mejor con popularidad estable, pero se "atasca" con datos antes populares.', '**FIFO / Random**: simples; Random es sorprendentemente decente.', '**TTL**: expiración por tiempo, complementaria a cualquiera de las anteriores.', 'Modernas: **W-TinyLFU** (Caffeine) combina frecuencia y recencia con muy buen hit rate.'] },
    { type: 'callout', tone: 'warn', title: 'Los 3 problemas clásicos', text: '**Cache stampede / thundering herd**: expira una clave popular y miles de peticiones van a la DB a la vez → usa locks/single-flight, expiración probabilística temprana o "stale-while-revalidate". **Penetración**: consultas a claves que no existen siempre fallan → cachea el "no existe" (negative caching) o usa un Bloom filter. **Avalancha**: muchas claves expiran a la vez → añade jitter al TTL.' },
    { type: 'callout', tone: 'tip', title: 'Invalidación', text: '"There are only two hard things in Computer Science: cache invalidation and naming things." En cache-aside, al escribir: **actualiza la DB y luego BORRA la clave** (no la actualices), para evitar que dos escrituras concurrentes dejen el valor viejo en caché.' },
    { type: 'callout', tone: 'interview', text: 'Siempre di: qué cacheas (clave y valor), dónde, el patrón, la política de expulsión, el TTL, cómo invalidas y qué hit rate esperas. Calcula: con 90% de hit rate la DB recibe 10× menos lecturas.' },
  ],
  simulator: 'cache',
  simIntro: 'Llega un stream de peticiones con distribución Zipf. Elige capacidad y política, y observa hits, misses y expulsiones en vivo.',
  code: { title: 'LRU O(1) + cache-aside', java: lruJava, python: lruPy, runJava: 'java labs/java/LruCache.java', runPython: 'python labs/python/lru_cache.py',
    notes: ['El LRU manual (hash map + lista doblemente enlazada) es una pregunta de entrevista de código clásica.', 'Java: en producción usa Caffeine (local) o Spring Cache + Redis. Python: functools.lru_cache, cachetools o redis-py.', 'Fíjate en `update`: invalida, no actualiza.'] },
  cloud: [
    { concept: 'Redis/Valkey gestionado', aws: 'ElastiCache (Valkey/Redis) / MemoryDB', azure: 'Azure Cache for Redis / Managed Redis', gcp: 'Memorystore (Valkey/Redis)' },
    { concept: 'Memcached gestionado', aws: 'ElastiCache for Memcached', azure: '—', gcp: 'Memorystore for Memcached' },
    { concept: 'Caché delante de DynamoDB', aws: 'DAX', azure: '—', gcp: '—' },
    { concept: 'Caché HTTP en el edge', aws: 'CloudFront', azure: 'Front Door', gcp: 'Cloud CDN' },
  ],
  realWorld: [
    { company: 'Facebook/Meta', title: 'Scaling Memcache', text: 'El paper de 2013 describe miles de servidores memcached. Introdujeron "leases" para evitar stampedes y escrituras viejas: solo quien tiene el lease puede llenar la clave tras un miss.' },
    { company: 'Netflix', title: 'EVCache', text: 'Capa de caché basada en memcached replicada entre zonas; cachea datos de personalización y metadatos para que las páginas carguen sin ir a las bases de datos primarias.' },
    { company: 'Twitter/X', title: 'Timelines en Redis', text: 'Las timelines de inicio se precomputan y guardan en clústeres Redis: leer tu feed es leer una lista ya armada en memoria.' },
  ],
  interview: {
    questions: ['¿Cache-aside o write-through para un perfil de usuario? ¿Y para un contador de likes?', '¿Qué es un cache stampede y cómo lo evitas?', 'Implementa una LRU cache con get/put en O(1).'],
    tips: ['Cuantifica el hit rate y su efecto en la DB.', 'Habla de TTL + invalidación explícita.', 'Menciona jitter en TTL y single-flight.'],
    redFlags: ['Cachear sin estrategia de invalidación.', 'Usar la caché como fuente de verdad sin persistencia.', 'Cachear datos por usuario con una clave que no incluye al usuario.'],
  },
  quiz: [
    { kind: 'single', q: 'Una clave muy popular expira y la DB recibe 20.000 consultas idénticas en un segundo. Esto es:', options: ['Cache penetration', 'Cache stampede (thundering herd)', 'Write-behind', 'Cache warming'], answer: 1, explain: 'Solución: una sola petición recarga (lock/single-flight) mientras las demás esperan o reciben el valor viejo.' },
    { kind: 'single', q: 'En cache-aside, tras actualizar la DB deberías:', options: ['Actualizar el valor en caché', 'Borrar (invalidar) la clave en caché', 'No hacer nada; el TTL lo arreglará', 'Vaciar toda la caché'], answer: 1, explain: 'Borrar evita carreras donde una escritura vieja sobrescribe a una nueva en caché. La siguiente lectura recarga.' },
    { kind: 'single', q: 'Si la DB recibe 50.000 lecturas/s y el hit rate pasa de 80% a 95%, las lecturas a la DB bajan de:', options: ['10.000 a 2.500/s', '40.000 a 47.500/s', '50.000 a 45.000/s', 'No cambian'], answer: 0, explain: 'Misses: 20% de 50k = 10k → 5% de 50k = 2,5k. Cada punto de hit rate al final importa mucho.' },
    { kind: 'multi', q: '¿Cuáles mitigan la avalancha/penetración de caché?', options: ['Jitter aleatorio en el TTL', 'Cachear resultados vacíos (negative caching)', 'Bloom filter de claves existentes', 'Quitar todos los TTL'], answers: [0, 1, 2], explain: 'Quitar TTLs llena la caché de basura y datos viejos.' },
    { kind: 'single', q: '¿Qué política es mejor cuando la popularidad cambia con el tiempo (noticias)?', options: ['LFU puro', 'LRU', 'Nunca expulsar', 'FIFO sin TTL'], answer: 1, explain: 'LFU puro favorece lo que fue popular ayer. LRU (o W-TinyLFU) se adapta a tendencias.' },
  ],
  flashcards: [
    { id: 'ca-1', front: 'Cache-aside', back: 'Lee caché → miss → lee DB → guarda en caché. En escritura: DB y luego invalidar.' },
    { id: 'ca-2', front: 'Write-behind', back: 'Escribe en caché y persiste en DB de forma asíncrona. Rápido; riesgo de pérdida.' },
    { id: 'ca-3', front: 'Cache stampede: 3 soluciones', back: 'Lock/single-flight, expiración temprana probabilística, stale-while-revalidate.' },
    { id: 'ca-4', front: 'Estructura de una LRU O(1)', back: 'HashMap (clave → nodo) + lista doblemente enlazada (orden de uso).' },
    { id: 'ca-5', front: 'Negative caching', back: 'Cachear "no existe" (con TTL corto) para evitar penetración a la DB.' },
  ],
  resources: [R.primer('#cache', 'Cache'), R.fbMemcache, R.karan],
}

export const apiDesign: Topic = {
  id: 'api-design',
  title: 'Diseño de APIs',
  subtitle: 'REST, gRPC, GraphQL, paginación, versionado, idempotencia',
  domain: 'api',
  icon: '🔌',
  pos: { x: 82, y: 33 },
  prerequisites: ['networking'],
  minutes: 18,
  blocks: [
    { type: 'p', text: 'La API es el contrato de tu sistema. En entrevistas define las APIs **antes** del diseño de alto nivel: te obliga a pensar qué datos entran, qué salen y con qué frecuencia.' },
    { type: 'table', head: ['Estilo', 'Fortalezas', 'Cuándo'], rows: [
      ['REST/JSON', 'Universal, cacheable por HTTP, fácil de depurar', 'APIs públicas, CRUD, web/mobile'],
      ['gRPC (Protobuf/HTTP2)', 'Binario, rápido, contratos tipados, streaming', 'Microservicios internos, baja latencia'],
      ['GraphQL', 'El cliente pide exactamente lo que necesita', 'Muchos clientes con necesidades distintas, BFF'],
      ['Eventos (Webhooks, async)', 'Desacople, notificaciones', 'Integraciones, pagos, "avísame cuando..."'],
    ] },
    { type: 'h', text: 'Buenas prácticas REST' },
    { type: 'list', items: [
      'Recursos con sustantivos: `GET /users/42/orders`, `POST /orders`.',
      'Códigos correctos: 201 Created, 204, 400, 401 vs 403, 404, 409 Conflict, **429** Too Many Requests, 503.',
      '**Paginación por cursor** (`?after=eyJpZCI6MTIzfQ`) en vez de `OFFSET` para listas grandes: OFFSET 1.000.000 obliga a la DB a recorrer un millón de filas y da resultados inconsistentes si se insertan elementos.',
      'Versionado: `/v1/` en la URL o header. Cambios **aditivos** no rompen clientes.',
      'Filtrado, orden y campos parciales: `?status=paid&sort=-created_at&fields=id,total`.',
    ] },
    { type: 'h', text: 'Idempotencia' },
    { type: 'p', text: 'Una operación es **idempotente** si repetirla produce el mismo efecto que hacerla una vez. GET, PUT y DELETE lo son por definición; **POST no**. En redes poco fiables los clientes reintentan, así que para operaciones críticas (pagos, pedidos) el cliente envía un header `Idempotency-Key` y el servidor guarda la respuesta asociada a esa clave.' },
    { type: 'callout', tone: 'interview', text: 'Para cada endpoint di: método, path, parámetros, respuesta y si es idempotente. Si hay reintentos o colas, la idempotencia es obligatoria: "procesamiento exactly-once" en la práctica es **at-least-once + idempotencia**.' },
  ],
  code: { title: 'Idempotency keys en una API de pagos', java: idemJava, python: idemPy, runJava: 'java labs/java/Idempotency.java', runPython: 'python labs/python/idempotency.py',
    notes: ['La reserva de la clave debe ser atómica: `putIfAbsent` / Redis `SET NX`.', 'Guarda un hash del payload: misma clave con distinto cuerpo es un error del cliente (422).', 'En Spring Boot: un filtro/HandlerInterceptor. En Python: un middleware de FastAPI.'] },
  cloud: [
    { concept: 'API Gateway', aws: 'API Gateway', azure: 'API Management', gcp: 'API Gateway / Apigee' },
    { concept: 'GraphQL gestionado', aws: 'AppSync', azure: 'API Management (GraphQL)', gcp: 'Apigee (GraphQL)' },
    { concept: 'gRPC detrás de LB', aws: 'ALB (soporta gRPC)', azure: 'Application Gateway for Containers', gcp: 'Cloud Run / Application LB' },
  ],
  realWorld: [
    { company: 'Stripe', title: 'Idempotency keys', text: 'Cada POST de la API de Stripe acepta `Idempotency-Key`. Los resultados se guardan 24 h; un reintento con la misma clave devuelve la misma respuesta, incluso errores 500.' },
    { company: 'Netflix / GitHub', title: 'GraphQL federado', text: 'GitHub expone una API GraphQL pública (v4). Netflix usa GraphQL federado para que muchos equipos contribuyan a un único grafo sin un monolito de API.' },
  ],
  interview: {
    questions: ['Diseña la API de un acortador de URLs.', '¿Cómo paginas un feed infinito?', '¿Cómo evitas cobrar dos veces si el cliente reintenta?'],
    tips: ['Paginación por cursor.', 'Idempotency-Key en POST críticos.', 'Menciona auth (OAuth2/JWT) y rate limiting en el gateway.'],
    redFlags: ['Verbos en URLs (`/getUser`).', 'OFFSET para feeds enormes.', 'Reintentos sin idempotencia.'],
  },
  quiz: [
    { kind: 'single', q: '¿Qué método HTTP NO es idempotente por definición?', options: ['GET', 'PUT', 'DELETE', 'POST'], answer: 3, explain: 'Dos POST /orders crean dos pedidos. Por eso se usan idempotency keys.' },
    { kind: 'single', q: 'Para un feed de millones de elementos con inserciones constantes, ¿qué paginación?', options: ['OFFSET/LIMIT', 'Por cursor (keyset)', 'Por número de página', 'Sin paginación'], answer: 1, explain: 'El cursor (p.ej. último id/timestamp) usa el índice y no salta ni duplica elementos cuando hay inserciones.' },
    { kind: 'single', q: 'El cliente supera su cuota de peticiones. ¿Código HTTP?', options: ['400', '403', '429', '503'], answer: 2, explain: '429 Too Many Requests, idealmente con header Retry-After.' },
    { kind: 'multi', q: '¿Cuándo preferir gRPC sobre REST?', options: ['Comunicación interna entre microservicios', 'Necesitas streaming bidireccional', 'API pública consumida desde navegadores sin proxy', 'Contratos tipados y alto rendimiento'], answers: [0, 1, 3], explain: 'Los navegadores no hablan gRPC nativo (se necesita gRPC-Web o un proxy).' },
    { kind: 'order', q: 'Ordena el flujo de una petición con idempotency key:', items: ['Cliente genera UUID y lo manda en el header', 'Servidor reserva la clave atómicamente', 'Ejecuta el cobro', 'Guarda la respuesta asociada a la clave', 'Reintento devuelve la respuesta guardada'], explain: 'La reserva atómica evita que dos reintentos simultáneos cobren dos veces.' },
  ],
  flashcards: [
    { id: 'api-1', front: '¿Por qué paginación por cursor?', back: 'OFFSET grande es O(n) y se desordena con inserciones; el cursor usa el índice y es estable.' },
    { id: 'api-2', front: 'Exactly-once en la práctica', back: 'At-least-once + operaciones idempotentes (deduplicación por clave).' },
    { id: 'api-3', front: '401 vs 403', back: '401: no autenticado (¿quién eres?). 403: autenticado pero sin permiso.' },
    { id: 'api-4', front: 'REST vs gRPC vs GraphQL en una línea', back: 'REST: universal/cacheable. gRPC: interno, rápido, tipado. GraphQL: el cliente elige campos.' },
  ],
  resources: [R.primer('#communication', 'Communication'), R.stripeIdem, R.ashish],
}

export const rateLimiting: Topic = {
  id: 'rate-limiting',
  title: 'Rate Limiting',
  subtitle: 'Token bucket, leaky bucket, ventanas fijas y deslizantes',
  domain: 'api',
  icon: '🚦',
  pos: { x: 84, y: 48 },
  prerequisites: ['api-design'],
  minutes: 15,
  blocks: [
    { type: 'p', text: 'Limitar cuántas peticiones acepta un cliente en un periodo protege tu sistema de abusos, bots, bugs de clientes que reintentan en bucle y de que un cliente ruidoso degrade a todos (**noisy neighbor**). También controla costos (p. ej. llamadas a un LLM de pago).' },
    { type: 'table', head: ['Algoritmo', 'Idea', 'Trade-off'], rows: [
      ['Token bucket', 'Tokens se recargan a tasa r hasta capacidad b; cada petición gasta uno', 'Permite ráfagas controladas. El más usado.'],
      ['Leaky bucket', 'Cola que se vacía a tasa constante', 'Salida suave; añade latencia, puede descartar ráfagas legítimas'],
      ['Fixed window', 'Contador por ventana (minuto 12:00, 12:01...)', 'Simple, pero permite 2× el límite en el borde de dos ventanas'],
      ['Sliding window log', 'Guarda timestamp de cada petición', 'Exacto, pero memoria O(peticiones)'],
      ['Sliding window counter', 'Ventana actual + anterior ponderada', 'Aproximado, memoria O(1). Lo usa Cloudflare.'],
    ] },
    { type: 'h', text: 'Rate limiting distribuido' },
    { type: 'list', items: [
      'Con 20 instancias, un contador local por instancia no sirve: el estado va en **Redis** con una operación atómica (`INCR` + `EXPIRE`, o un **script Lua** para token bucket).',
      'Límites por **API key / usuario / IP / endpoint**; distintos tiers (free vs pro).',
      'Responde **429** con `Retry-After` y headers `RateLimit-Limit/Remaining/Reset`.',
      'Si Redis cae: ¿fail open (dejar pasar) o fail closed? Normalmente **fail open** con límite local de emergencia.',
      'Ubicación: en el API Gateway/edge para cortar tráfico lo antes posible.',
    ] },
    { type: 'callout', tone: 'tip', title: 'Load shedding ≠ rate limiting', text: 'Rate limiting es por cliente ("tú no más de 100/s"). Load shedding protege al servidor ("estoy al 95% de CPU: rechazo tráfico de baja prioridad"). Stripe usa ambos.' },
  ],
  simulator: 'rate-limiter',
  simIntro: 'Bombardea un endpoint con distintos patrones de tráfico y compara cómo responde cada algoritmo. Reto: descubre el bug del borde de ventana.',
  code: { title: 'Token bucket + sliding window counter + limitador por cliente', java: rlJava, python: rlPy, runJava: 'java labs/java/RateLimiter.java', runPython: 'python labs/python/rate_limiter.py',
    notes: ['La recarga "perezosa" calcula tokens al consultar: no hace falta un timer.', 'Inyectar el reloj (clock) hace el código testeable de forma determinista.', 'Java: Bucket4j o Resilience4j RateLimiter. Python: limits, slowapi (FastAPI) o redis-py con Lua.'] },
  cloud: [
    { concept: 'Throttling en gateway', aws: 'API Gateway usage plans', azure: 'API Management rate-limit policies', gcp: 'Apigee Spike Arrest / Quota' },
    { concept: 'Rate limiting en el edge / WAF', aws: 'AWS WAF rate-based rules', azure: 'Front Door WAF rate limit', gcp: 'Cloud Armor rate limiting' },
    { concept: 'Estado compartido', aws: 'ElastiCache (Valkey/Redis)', azure: 'Azure Cache for Redis', gcp: 'Memorystore' },
  ],
  realWorld: [
    { company: 'Stripe', title: '4 tipos de limitadores', text: 'Request rate limiter (token bucket por usuario), concurrent requests limiter, fleet usage load shedder (reserva capacidad para tráfico crítico) y worker utilization load shedder.' },
    { company: 'Cloudflare', title: 'Sliding window a escala', text: 'Para millones de dominios usan el contador de ventana deslizante aproximado: solo 2 números por cliente y un error muy pequeño frente a la ventana exacta.' },
    { company: 'GitHub', title: 'Límites con headers', text: 'La API REST de GitHub devuelve x-ratelimit-limit / remaining / reset en cada respuesta para que los clientes se autorregulen.' },
  ],
  interview: {
    questions: ['Diseña un rate limiter distribuido para una API con 1 M de usuarios.', '¿Token bucket o sliding window? ¿Por qué?', '¿Qué haces si Redis (el estado del limitador) no está disponible?'],
    tips: ['Explica el problema del borde en fixed window.', 'Script Lua para atomicidad.', 'Headers de rate limit + 429 + Retry-After.'],
    redFlags: ['Contadores en memoria local con varias instancias.', 'Read-modify-write en Redis sin atomicidad.'],
  },
  quiz: [
    { kind: 'single', q: 'Límite 100/min con ventana fija. ¿Cuántas peticiones puede pasar un cliente en ~1 segundo alrededor del cambio de minuto?', options: ['100', '~200', '~50', '0'], answer: 1, explain: '100 al final del minuto 1 y 100 al inicio del minuto 2: el doble del límite en un instante.' },
    { kind: 'single', q: '¿Qué parámetro del token bucket controla la ráfaga máxima?', options: ['La tasa de recarga', 'La capacidad del bucket', 'El TTL', 'El número de instancias'], answer: 1, explain: 'Capacidad = ráfaga; tasa de recarga = tasa sostenida.' },
    { kind: 'single', q: '¿Cómo garantizas atomicidad del token bucket en Redis?', options: ['GET y luego SET desde la app', 'Un script Lua (EVAL) que lee, calcula y escribe', 'Usar TTL largo', 'Un lock en la app de cada instancia'], answer: 1, explain: 'Redis ejecuta Lua de forma atómica: nadie se intercala entre leer y escribir.' },
    { kind: 'multi', q: '¿Qué debería incluir una respuesta limitada?', options: ['Código 429', 'Header Retry-After', 'Código 500', 'Headers de límite restante'], answers: [0, 1, 3], explain: '500 indica error del servidor, no del cliente.' },
    { kind: 'single', q: 'Una ráfaga legítima de 20 peticiones debe pasar, pero el promedio sostenido no debe superar 5/s. ¿Algoritmo?', options: ['Leaky bucket con cola de 1', 'Token bucket (capacidad 20, recarga 5/s)', 'Fixed window de 5/s', 'Ninguno'], answer: 1, explain: 'Token bucket modela exactamente "ráfaga b, tasa sostenida r".' },
  ],
  flashcards: [
    { id: 'rl-1', front: 'Token bucket: parámetros', back: 'Capacidad (ráfaga máxima) y tasa de recarga (tasa sostenida).' },
    { id: 'rl-2', front: 'Problema de fixed window', back: 'En el borde entre ventanas permite hasta 2× el límite.' },
    { id: 'rl-3', front: 'Sliding window counter', back: 'estimado = actual + anterior × fracción de solape. O(1) memoria, aproximado.' },
    { id: 'rl-4', front: 'Fail open vs fail closed', back: 'Si el limitador falla: dejar pasar (disponibilidad) o bloquear (protección). Habitual: fail open.' },
  ],
  resources: [R.stripeRate, R.ashish, R.primer()],
}
