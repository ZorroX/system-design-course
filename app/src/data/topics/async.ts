import type { Topic } from '../types'
import { R } from '../resources'
import mkJava from '@labs/java/MiniKafka.java?raw'
import mkPy from '@labs/python/mini_kafka.py?raw'
import cbJava from '@labs/java/CircuitBreaker.java?raw'
import cbPy from '@labs/python/circuit_breaker.py?raw'

export const messaging: Topic = {
  id: 'messaging',
  title: 'Colas, streams y eventos',
  subtitle: 'SQS vs Kafka, pub/sub, consumer groups, DLQ, outbox',
  domain: 'async',
  icon: '📨',
  pos: { x: 50, y: 63 },
  prerequisites: ['replication-cap'],
  minutes: 22,
  blocks: [
    { type: 'p', text: 'La comunicación asíncrona desacopla al productor del consumidor: el usuario recibe "pedido recibido" en 50 ms mientras el email, la factura y el análisis se procesan después. Además **absorbe picos** (la cola crece y los workers drenan a su ritmo) y aísla fallos (si el servicio de email cae, los mensajes esperan).' },
    { type: 'tradeoff',
      left: { title: 'Cola de mensajes (SQS, RabbitMQ)', items: ['Cada mensaje lo procesa UN consumidor', 'Se borra tras el ack', 'Ideal para tareas/trabajos', 'Visibility timeout, reintentos, DLQ'] },
      right: { title: 'Log de eventos (Kafka, Kinesis)', items: ['Log append-only particionado y retenido', 'Muchos consumer groups leen lo mismo', 'Replay: re-procesar desde un offset', 'Orden garantizado por partición'] } },
    { type: 'h', text: 'Conceptos clave de Kafka' },
    { type: 'list', items: [
      '**Topic** dividido en **particiones**; cada partición es un log ordenado. La clave del mensaje decide la partición → mismo `user_id`, mismo orden.',
      '**Consumer group**: cada partición la lee un solo consumidor del grupo. Paralelismo máximo = nº de particiones.',
      '**Offset**: posición de lectura. Commitear tras procesar = **at-least-once** (posibles duplicados → idempotencia).',
      '**Lag**: mensajes pendientes. La métrica nº 1 para autoscaling de consumidores.',
      'Retención por tiempo/tamaño o **log compaction** (última versión por clave).',
    ] },
    { type: 'h', text: 'Garantías de entrega' },
    { type: 'table', head: ['Garantía', 'Qué pasa', 'Cuándo'], rows: [
      ['At-most-once', 'Commit antes de procesar: puede perder', 'Métricas, logs no críticos'],
      ['At-least-once', 'Commit después: puede duplicar', 'El default sensato + consumidores idempotentes'],
      ['Exactly-once', 'Transacciones (Kafka EOS) dentro del ecosistema', 'Stream processing Kafka→Kafka'],
    ] },
    { type: 'callout', tone: 'warn', title: 'El problema de la doble escritura', text: 'Guardar en la DB y publicar en Kafka son dos sistemas: si falla entre ambos, quedan inconsistentes. **Transactional outbox**: escribe el evento en una tabla `outbox` dentro de la misma transacción de la DB, y un relay (o CDC con Debezium) lo publica. **Dead Letter Queue**: mensajes que fallan N veces van a una cola aparte para inspección, en lugar de bloquear la partición.' },
    { type: 'callout', tone: 'interview', text: 'Úsalo cuando el trabajo es lento, no necesita respuesta inmediata o hay picos. Di: qué es el mensaje, la clave de partición (para orden), cuántas particiones, garantía de entrega, cómo logras idempotencia y qué pasa con los mensajes venenosos (DLQ).' },
  ],
  simulator: 'queue',
  simIntro: 'Productores, una cola particionada y consumidores. Lanza un pico de tráfico, observa el lag y escala consumidores... ¿por qué algunos se quedan ociosos?',
  code: { title: 'Mini-Kafka: particiones, consumer groups y offsets', java: mkJava, python: mkPy, runJava: 'java labs/java/MiniKafka.java', runPython: 'python labs/python/mini_kafka.py',
    notes: ['La misma clave siempre cae en la misma partición: orden por entidad.', 'Dos consumer groups leen el mismo stream con offsets independientes.', 'Java: spring-kafka (@KafkaListener). Python: confluent-kafka o aiokafka. Para colas simples: SQS con boto3 / AWS SDK v2.'] },
  cloud: [
    { concept: 'Cola de mensajes', aws: 'SQS', azure: 'Service Bus Queues / Storage Queues', gcp: 'Pub/Sub (pull) / Cloud Tasks' },
    { concept: 'Pub/Sub fan-out', aws: 'SNS (+ SQS)', azure: 'Service Bus Topics / Event Grid', gcp: 'Pub/Sub' },
    { concept: 'Log de eventos / streaming', aws: 'MSK (Kafka) / Kinesis Data Streams', azure: 'Event Hubs (API Kafka)', gcp: 'Managed Service for Apache Kafka / Pub/Sub' },
    { concept: 'Bus de eventos / integración', aws: 'EventBridge', azure: 'Event Grid', gcp: 'Eventarc' },
    { concept: 'Orquestación de workflows', aws: 'Step Functions', azure: 'Durable Functions / Logic Apps', gcp: 'Workflows' },
  ],
  realWorld: [
    { company: 'LinkedIn', title: 'El origen de Kafka', text: 'Kafka nació en LinkedIn (~2010) para unificar el pipeline de actividad y logs en un log distribuido. Hoy procesa billones de mensajes al día allí.' },
    { company: 'Uber', title: 'Kafka como sistema nervioso', text: 'Uber usa Kafka para viajes, pagos, precios dinámicos y analítica en tiempo real, con replicación entre regiones (uReplicator) y consumer proxies.' },
    { company: 'Shopify', title: 'Black Friday con colas', text: 'Las tareas no críticas del checkout (emails, webhooks a apps) se encolan para que el camino crítico de pago quede libre en los picos.' },
  ],
  interview: {
    questions: ['¿SQS o Kafka para enviar emails de confirmación? ¿Y para un pipeline de analítica?', '¿Cómo garantizas que un evento se publica si la transacción se confirmó?', 'El lag de consumidores crece sin parar. ¿Qué haces?'],
    tips: ['Outbox pattern para consistencia DB↔broker.', 'Particiones ≥ consumidores máximos.', 'DLQ + alertas + idempotencia.'],
    redFlags: ['Asumir exactly-once mágico.', 'Más consumidores que particiones esperando más throughput.', 'Usar la cola como base de datos.'],
  },
  quiz: [
    { kind: 'single', q: 'Topic con 6 particiones y 10 consumidores en el mismo grupo. ¿Cuántos procesan mensajes?', options: ['10', '6', '1', '16'], answer: 1, explain: 'Cada partición se asigna a un único consumidor del grupo: 4 quedan ociosos.' },
    { kind: 'single', q: 'Necesitas que los eventos de un mismo pedido se procesen en orden. ¿Qué haces?', options: ['Usar order_id como clave del mensaje', 'Una partición por consumidor', 'Clave aleatoria', 'Desactivar la retención'], answer: 0, explain: 'Misma clave → misma partición → orden garantizado dentro de ella.' },
    { kind: 'single', q: 'Commiteas el offset DESPUÉS de procesar. ¿Garantía?', options: ['At-most-once', 'At-least-once', 'Exactly-once', 'Ninguna'], answer: 1, explain: 'Si el consumidor muere tras procesar y antes de commitear, el mensaje se re-entrega: duplicado posible.' },
    { kind: 'multi', q: '¿Qué resuelve el transactional outbox?', options: ['Doble escritura DB + broker inconsistente', 'Publicar eventos solo si la transacción se confirmó', 'Reducir la latencia de la DB', 'Eliminar la necesidad de idempotencia'], answers: [0, 1], explain: 'El relay puede publicar dos veces: los consumidores siguen necesitando idempotencia.' },
    { kind: 'single', q: 'Un mensaje mal formado hace fallar al consumidor una y otra vez, bloqueando la partición. Solución:', options: ['Reiniciar el broker', 'Reintentos limitados y luego enviarlo a una Dead Letter Queue', 'Borrar el topic', 'Aumentar las particiones'], answer: 1, explain: 'La DLQ aísla los "mensajes venenosos" para revisarlos sin detener el flujo.' },
  ],
  flashcards: [
    { id: 'mq-1', front: 'Cola vs log', back: 'Cola: un consumidor por mensaje, se borra. Log: retenido, múltiples grupos, replay, orden por partición.' },
    { id: 'mq-2', front: 'Paralelismo máximo en Kafka', back: 'Nº de particiones del topic (por consumer group).' },
    { id: 'mq-3', front: 'Transactional outbox', back: 'Evento en tabla outbox en la misma transacción; un relay/CDC lo publica.' },
    { id: 'mq-4', front: 'Consumer lag', back: 'Mensajes producidos aún no consumidos. Métrica clave para alertas y autoscaling.' },
    { id: 'mq-5', front: 'Dead Letter Queue', back: 'Destino de mensajes que fallan N veces, para no bloquear y poder inspeccionarlos.' },
  ],
  resources: [R.primer('#asynchronism', 'Asynchronism'), R.ddia, R.scalability],
}

export const reliability: Topic = {
  id: 'reliability',
  title: 'Resiliencia y tolerancia a fallos',
  subtitle: 'Timeouts, retries con jitter, circuit breaker, bulkheads, chaos',
  domain: 'reliability',
  icon: '🛡️',
  pos: { x: 72, y: 78 },
  prerequisites: ['rate-limiting', 'messaging'],
  minutes: 20,
  blocks: [
    { type: 'p', text: 'En un sistema distribuido todo falla: redes, discos, dependencias, regiones enteras. El objetivo no es evitar fallos sino **contenerlos** para que un servicio lento no tumbe a todos (fallo en cascada).' },
    { type: 'h', text: 'El kit básico' },
    { type: 'list', items: [
      '**Timeouts** en TODA llamada remota. Sin timeout, un servicio lento acapara hilos hasta agotar el pool.',
      '**Retries con backoff exponencial + jitter**, solo para errores transitorios y operaciones idempotentes. Limita el total (retry budget) para no multiplicar la carga.',
      '**Circuit breaker**: tras X% de fallos, deja de llamar (fail fast) durante un tiempo; luego prueba con pocas peticiones (half-open).',
      '**Bulkhead**: pools de recursos separados por dependencia, para que una lenta no consuma los hilos de las demás.',
      '**Fallbacks / degradación**: recomendaciones genéricas si el servicio de personalización cae; servir desde caché vieja.',
      '**Load shedding**: rechazar trabajo de baja prioridad cuando estás saturado.',
    ] },
    { type: 'callout', tone: 'warn', title: 'Retry storms', text: 'Si 3 capas reintentan 3 veces cada una, un fallo en el fondo genera 3³ = 27 peticiones. Reintenta en **una sola capa**, con jitter, y respeta `Retry-After`.' },
    { type: 'h', text: 'Redundancia y despliegue' },
    { type: 'table', head: ['Nivel', 'Protege contra', 'Costo'], rows: [
      ['Multi-instancia', 'Caída de una máquina', 'Bajo'],
      ['Multi-AZ', 'Caída de un datacenter', 'Medio (latencia entre AZ ~1-2 ms)'],
      ['Multi-región activo-pasivo', 'Caída de una región (RTO minutos)', 'Alto'],
      ['Multi-región activo-activo', 'Región + latencia global', 'Muy alto: consistencia de datos'],
    ] },
    { type: 'p', text: '**RPO** (Recovery Point Objective): cuántos datos puedes perder. **RTO** (Recovery Time Objective): cuánto puedes tardar en recuperarte. **SLI** (lo que mides, p. ej. % de peticiones < 300 ms), **SLO** (tu objetivo interno, 99.9%), **SLA** (contrato con el cliente). El **error budget** (100% − SLO) decide cuándo frenar features para priorizar estabilidad.' },
    { type: 'callout', tone: 'interview', text: 'Para cada dependencia de tu diagrama pregunta en voz alta "¿y si esto cae o va lento?". Responder con timeout + retry con jitter + circuit breaker + fallback + alertas sobre SLO te diferencia como senior.' },
  ],
  simulator: 'circuit-breaker',
  simIntro: 'Un servicio de pagos empieza a fallar. Configura el circuit breaker y observa cómo protege los hilos de tu aplicación. Reto: haz que recorra los 3 estados.',
  code: { title: 'Circuit breaker + retry con backoff exponencial y jitter', java: cbJava, python: cbPy, runJava: 'java labs/java/CircuitBreaker.java', runPython: 'python labs/python/circuit_breaker.py',
    notes: ['Java en producción: Resilience4j (@CircuitBreaker, @Retry, @Bulkhead, @TimeLimiter) con Spring Boot.', 'Python: tenacity para retries, pybreaker / aiobreaker para circuit breakers.', 'Full jitter: espera = random(0, min(cap, base·2ⁿ)).'] },
  cloud: [
    { concept: 'Multi-AZ / zonas', aws: 'Availability Zones', azure: 'Availability Zones', gcp: 'Zones' },
    { concept: 'Chaos engineering', aws: 'Fault Injection Service (FIS)', azure: 'Azure Chaos Studio', gcp: 'Chaos Toolkit / Litmus en GKE' },
    { concept: 'Health / failover DNS', aws: 'Route 53 health checks', azure: 'Traffic Manager', gcp: 'Cloud DNS routing policies' },
    { concept: 'SLOs y alertas', aws: 'CloudWatch Application Signals', azure: 'Azure Monitor SLOs', gcp: 'Cloud Monitoring SLOs' },
  ],
  realWorld: [
    { company: 'Netflix', title: 'Chaos Monkey e Hystrix', text: 'Chaos Monkey apaga instancias en producción para forzar diseños resilientes. Hystrix popularizó circuit breakers y bulkheads en Java (hoy en mantenimiento; la comunidad usa Resilience4j).' },
    { company: 'AWS', title: 'Backoff exponencial con jitter', text: 'El blog de arquitectura de AWS mostró que "full jitter" reduce drásticamente el trabajo total y la contención frente al backoff sin jitter. Los SDKs de AWS lo aplican por defecto.' },
    { company: 'Google', title: 'SRE y error budgets', text: 'El libro de SRE de Google formalizó SLI/SLO/error budget: si se agota el presupuesto de errores, se congelan lanzamientos y se prioriza la fiabilidad.' },
  ],
  interview: {
    questions: ['El servicio de recomendaciones tarda 10 s en responder. ¿Cómo evitas que tumbe la página principal?', '¿Cuándo NO debes reintentar?', 'Diseña para 99.99% de disponibilidad. ¿Qué cambia respecto a 99.9%?'],
    tips: ['Timeout + breaker + fallback.', 'Reintentos solo idempotentes y con jitter.', 'Habla de RPO/RTO y multi-AZ.'],
    redFlags: ['Retries infinitos sin backoff.', 'Sin timeouts.', 'Prometer 99.999% con una sola región.'],
  },
  quiz: [
    { kind: 'single', q: 'Un circuit breaker está OPEN. ¿Qué pasa con una nueva llamada?', options: ['Se envía normalmente', 'Falla inmediatamente o usa el fallback', 'Espera a que el servicio se recupere', 'Se reintenta 3 veces'], answer: 1, explain: 'Fail fast: no se gastan hilos ni se castiga más al servicio enfermo.' },
    { kind: 'single', q: '¿Por qué añadir jitter al backoff exponencial?', options: ['Para reintentar más rápido', 'Para que muchos clientes no reintenten sincronizados (thundering herd)', 'Para cifrar las peticiones', 'Es obligatorio en HTTP'], answer: 1, explain: 'Sin jitter, todos los clientes que fallaron a la vez reintentan a la vez.' },
    { kind: 'multi', q: '¿Qué errores son buenos candidatos para reintentar?', options: ['503 Service Unavailable', 'Timeout de red', '400 Bad Request', '429 (respetando Retry-After)'], answers: [0, 1, 3], explain: 'Un 400 fallará igual la próxima vez: el error es del cliente.' },
    { kind: 'order', q: 'Ordena los estados de un circuit breaker durante un incidente y su recuperación:', items: ['CLOSED', 'OPEN', 'HALF_OPEN', 'CLOSED'], explain: 'Cerrado → muchos fallos → abierto → pasa el tiempo → semiabierto (prueba) → éxito → cerrado.' },
    { kind: 'single', q: 'Pool de 200 hilos; una dependencia lenta los consume todos y el resto de endpoints dejan de responder. ¿Patrón que lo previene?', options: ['Bulkhead', 'Sharding', 'CDN', 'Write-behind'], answer: 0, explain: 'Bulkhead = compartimentos estancos: un pool limitado por dependencia.' },
  ],
  flashcards: [
    { id: 're-1', front: 'Estados del circuit breaker', back: 'CLOSED (normal) → OPEN (fail fast) → HALF_OPEN (prueba) → CLOSED/OPEN.' },
    { id: 're-2', front: 'Full jitter', back: 'sleep = random(0, min(cap, base × 2^intento)).' },
    { id: 're-3', front: 'RPO vs RTO', back: 'RPO: datos que puedes perder. RTO: tiempo hasta recuperarte.' },
    { id: 're-4', front: 'SLI / SLO / SLA', back: 'SLI: métrica. SLO: objetivo interno. SLA: contrato con penalizaciones.' },
    { id: 're-5', front: 'Bulkhead', back: 'Aislar recursos (pools/hilos/conexiones) por dependencia para contener fallos.' },
  ],
  resources: [R.awsBackoff, R.resilience4j, R.tenacity, R.primer('#availability-patterns', 'Availability patterns')],
}
