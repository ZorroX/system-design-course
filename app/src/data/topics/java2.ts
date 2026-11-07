import type { Topic } from '../types'
import tccJava from '@labs/java/Tcc.java?raw'
import tccPy from '@labs/python/tcc.py?raw'

/* ============================================================================
 * Ruta "Entrevista Java Backend · Pagos" — Etapas 2 y 3
 * ========================================================================== */

export const distributedTx: Topic = {
  id: 'distributed-tx',
  title: 'Transacciones distribuidas: Saga, TCC y Outbox',
  subtitle: 'Orquestación vs. coreografía paso a paso, pivote, TCC, outbox/inbox, semántica de entrega y DLQ',
  domain: 'distributed',
  icon: '🔗',
  track: 'java',
  pos: { x: 10, y: 40 },
  prerequisites: ['microservices', 'messaging'],
  minutes: 30,
  blocks: [
    { type: 'p', text: 'Un pago toca varios servicios con su propia base de datos: billetera, antifraude, adquirente, ledger del comercio, notificaciones. No hay una transacción ACID que los abarque. [[two-pc|2PC]] bloquea recursos y depende de un coordinador que puede caer, así que en microservicios se usa **consistencia eventual controlada**: sagas, TCC y outbox, todo apoyado en idempotencia.' },
    { type: 'h', text: 'Saga paso a paso (orquestada)' },
    { type: 'table', head: ['Paso', 'Acción', 'Compensación', 'Tipo'], rows: [
      ['1', 'Billetera: reservar $80', 'Liberar la reserva', 'Compensable'],
      ['2', 'Antifraude: evaluar', '— (solo lectura)', 'Compensable'],
      ['3', 'Adquirente: cobrar la tarjeta', 'Reembolsar', '**Pivote**'],
      ['4', 'Ledger: acreditar al comercio', '—', 'Reintentable'],
      ['5', 'Notificar al cliente', '—', 'Reintentable'],
    ] },
    { type: 'list', items: [
      'Antes del **pivote**, si algo falla se compensa **hacia atrás** en orden inverso.',
      'Después del pivote, los pasos deben ser **reintentables** e idempotentes: se recupera **hacia adelante** (reintentar con backoff), no se deshace una venta válida por un timeout.',
      'Las compensaciones son acciones de negocio (reembolso, liberación), no borrados. Dejan rastro auditable.',
      '**Bloqueo semántico**: estados como `PENDIENTE` evitan que otros lean el pedido como definitivo mientras la saga corre.',
      'El estado de la saga se persiste (tabla de saga o motor como Temporal/Step Functions) para sobrevivir a la caída del orquestador.',
    ] },
    { type: 'tradeoff', left: { title: 'Orquestación', items: ['Un coordinador dice a cada servicio qué hacer', 'Flujo visible en un solo lugar; fácil de monitorear y cambiar', 'Riesgo: el orquestador concentra lógica', 'Temporal, Camunda, AWS Step Functions'] }, right: { title: 'Coreografía', items: ['Cada servicio reacciona a eventos y publica los suyos', 'Muy desacoplado; sin punto central', 'Difícil de seguir con muchos pasos (necesita tracing)', 'Kafka/EventBridge + outbox'] } },
    { type: 'h', text: 'TCC: Try-Confirm-Cancel' },
    { type: 'list', items: [
      '**Try**: valida y **reserva** (congela fondos, aparta stock). **Confirm**: consume la reserva. **Cancel**: la libera.',
      'Ventaja frente a la saga: nunca gastas dinero que luego debas devolver; los participantes ven reservas, no efectos a medias.',
      'Coste: cada participante implementa tres operaciones y guarda un registro por transacción.',
      'Tres problemas clásicos: **idempotencia** (Confirm/Cancel duplicados), **cancelación vacía** (llega Cancel sin Try: registrarla) y **suspensión** (llega Try después de Cancel: rechazarlo para no congelar fondos para siempre).',
      'Muy usado en sistemas financieros de gran escala; Seata (open source de Alibaba) ofrece modo TCC para Java.',
    ] },
    { type: 'h', text: 'Transactional Outbox (y su espejo: Inbox)' },
    { type: 'p', text: 'Guardar en la BD y publicar en Kafka son dos sistemas: si el proceso muere entre ambos, pierdes el evento o lo publicas sin haber guardado. El [[outbox|outbox]] guarda el evento en una tabla **en la misma transacción** que el cambio de negocio; un relay (polling) o CDC (Debezium leyendo el WAL) lo publica después. El consumidor guarda los ids procesados en una tabla **inbox** con UNIQUE para descartar duplicados.' },
    { type: 'code', lang: 'java', title: 'Outbox con Spring: una sola transacción', code: `@Transactional
public void capture(Payment p) {
    p.markCaptured();                                   // estado del pago
    ledger.post(p.merchantId(), p.amountCents());        // asientos de doble partida
    outbox.save(new OutboxEvent("PaymentCaptured", p.id(), toJson(p))); // misma tx
}
// Un relay (@Scheduled o Debezium) lee la tabla outbox y publica en Kafka.
// El consumidor: INSERT INTO inbox(event_id) ... ON CONFLICT DO NOTHING → si 0 filas, ya lo procesó.` },
    { type: 'h', text: 'Kafka y RabbitMQ: lo que preguntan' },
    { type: 'table', head: ['Tema', 'Kafka', 'RabbitMQ'], rows: [
      ['Modelo', 'Log particionado y replicado; los consumidores llevan su offset', 'Colas con ack por mensaje; exchanges y routing'],
      ['Orden', 'Solo dentro de una partición (misma clave → misma partición)', 'Por cola, con un solo consumidor'],
      ['Durabilidad', '`replication.factor=3`, `min.insync.replicas=2`, `acks=all`', 'Colas durables + quorum queues + publisher confirms'],
      ['Reintentos', 'Topics de reintento (retry-5s, retry-1m) + DLT', 'Dead Letter Exchange + TTL'],
      ['Paralelismo', 'Consumidores ≤ particiones', 'Varios consumidores por cola, prefetch'],
    ] },
    { type: 'list', items: [
      '**At-most-once**: commit del offset antes de procesar (puedes perder). **At-least-once**: procesar y luego commit (puedes duplicar) — lo habitual.',
      '**Exactly-once** de Kafka (productor idempotente + transacciones) aplica a leer-procesar-escribir **dentro de Kafka**. Con efectos externos (BD, APIs) se logra con at-least-once + idempotencia.',
      '**DLQ**: tras N reintentos con backoff, el mensaje venenoso va a una cola aparte con alerta, para no bloquear la partición. Debe haber un proceso para revisarlos y reinyectarlos.',
    ] },
    { type: 'callout', tone: 'interview', text: 'Para "diseña el flujo de un pago entre microservicios" di: saga orquestada con pivote en el cobro, compensaciones idempotentes, outbox para publicar eventos, consumidores idempotentes con inbox, reintentos con backoff y DLQ con alertas. Si te preguntan por fondos, ofrece TCC (reservar/confirmar/cancelar) y explica cancelación vacía y suspensión.' },
  ],
  code: { title: 'Participante TCC + outbox con deduplicación', java: tccJava, python: tccPy, runJava: 'java labs/java/Tcc.java', runPython: 'python labs/python/tcc.py',
    notes: ['Mismos mensajes que la Ruta de las Caravanas en NIMBUS: duplicados, Cancel antes que Try y fondos insuficientes.', 'El invariante disponible + congelado + confirmado se mantiene siempre.', 'El lab "Saga" del tema Microservicios muestra orquestación con compensaciones.'] },
  cloud: [
    { concept: 'Orquestador de sagas', aws: 'Step Functions', azure: 'Durable Functions / Logic Apps', gcp: 'Workflows' },
    { concept: 'Kafka gestionado', aws: 'Amazon MSK', azure: 'Event Hubs (API Kafka) / Confluent', gcp: 'Managed Service for Apache Kafka / Confluent' },
    { concept: 'CDC para outbox', aws: 'DMS / MSK Connect + Debezium', azure: 'Debezium en Container Apps / Event Hubs', gcp: 'Datastream / Debezium' },
  ],
  realWorld: [
    { company: 'Uber', title: 'Cadence → Temporal', text: 'Uber creó Cadence para orquestar flujos de larga duración (como pagos y viajes) con estado persistente; sus autores fundaron después Temporal.' },
    { company: 'Alibaba', title: 'Seata', text: 'Framework open source de transacciones distribuidas con modos AT, TCC, Saga y XA, nacido para el comercio electrónico de Alibaba a escala de Singles Day.' },
    { company: 'Wix / Shopify', title: 'Outbox con CDC', text: 'Muchas plataformas publican eventos de dominio leyendo el WAL de la base con Debezium, evitando la doble escritura.' },
  ],
  interview: {
    questions: ['Explica una saga paso a paso para un pago. ¿Qué pasa si falla el cuarto paso?', 'Orquestación vs coreografía: ¿cuándo cada una?', '¿Qué es TCC y qué son la cancelación vacía y la suspensión?', '¿Cómo garantizas que el evento se publica si el proceso muere tras el commit?', '¿Kafka garantiza exactly-once?'],
    tips: ['Nombra el pivote y la recuperación hacia adelante.', 'Outbox + inbox + idempotencia.', 'Exactly-once de negocio = at-least-once + idempotencia.'],
    redFlags: ['Proponer 2PC entre microservicios sin mencionar sus problemas.', 'Compensar borrando filas.', 'Asumir que Kafka entrega exactamente una vez a tu base de datos.'],
  },
  quiz: [
    { kind: 'single', q: 'La saga cobró la tarjeta (pivote) y luego el servicio del comercio da timeout. ¿Qué hace el orquestador?', options: ['Reembolsar y liberar todo', 'Reintentar el abono con backoff (paso reintentable e idempotente)', 'Abandonar', 'Cobrar otra vez'], answer: 1, explain: 'Tras el pivote se recupera hacia adelante: el abono es idempotente y se reintenta.' },
    { kind: 'order', q: 'Falla el paso 3 (cobro). Ordena las compensaciones:', items: ['Antifraude: nada que compensar (solo leyó)', 'Billetera: liberar la reserva', 'Pedido: marcar CANCELADO'], explain: 'Orden inverso a la ejecución, y solo de los pasos completados.' },
    { kind: 'single', q: 'En TCC llega un Cancel para T7 sin que haya llegado su Try. ¿Qué hace el participante?', options: ['Ignorarlo sin registrar nada', 'Registrar una cancelación vacía para rechazar un Try tardío', 'Congelar fondos', 'Lanzar error al coordinador'], answer: 1, explain: 'Si no lo registra, el Try retrasado congelaría fondos que nadie liberará (suspensión).' },
    { kind: 'single', q: '¿Qué resuelve el transactional outbox?', options: ['El orden global de mensajes', 'La doble escritura BD + broker inconsistente', 'La latencia de Kafka', 'El rebalanceo de consumidores'], answer: 1, explain: 'El evento se guarda en la misma transacción que el cambio; un relay lo publica al menos una vez.' },
    { kind: 'multi', q: 'Un consumidor at-least-once que escribe en Postgres debe…', options: ['Ser idempotente (inbox con UNIQUE por event_id)', 'Hacer commit del offset después de procesar', 'Mandar a una DLQ tras N reintentos', 'Confiar en exactly-once de Kafka para la escritura en Postgres'], answers: [0, 1, 2], explain: 'El exactly-once de Kafka no cubre efectos en sistemas externos.' },
  ],
  flashcards: [
    { id: 'dt-1', front: 'Pivote de una saga', back: 'El paso tras el cual ya no se compensa: lo siguiente es reintentable y se avanza.' },
    { id: 'dt-2', front: 'TCC', back: 'Try reserva, Confirm consume, Cancel libera. Idempotencia, cancelación vacía y anti-suspensión.' },
    { id: 'dt-3', front: 'Outbox / Inbox', back: 'Outbox: evento en la misma tx que el cambio. Inbox: ids procesados con UNIQUE en el consumidor.' },
    { id: 'dt-4', front: 'Semánticas de entrega', back: 'At-most-once (commit antes), at-least-once (commit después, lo normal), exactly-once (Kafka interno o idempotencia).' },
    { id: 'dt-5', front: 'Durabilidad en Kafka', back: 'replication.factor=3, min.insync.replicas=2, acks=all, enable.idempotence=true.' },
  ],
  resources: [
    { title: 'microservices.io: Saga', url: 'https://microservices.io/patterns/data/saga.html' },
    { title: 'microservices.io: Transactional Outbox', url: 'https://microservices.io/patterns/data/transactional-outbox.html' },
    { title: 'Seata: TCC mode', url: 'https://seata.apache.org/docs/dev/mode/tcc-mode/' },
    { title: 'Confluent: Exactly-once semantics in Kafka', url: 'https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/' },
    { title: 'Caitie McCaffrey: Distributed Sagas (charla)', url: 'https://www.youtube.com/watch?v=0UTOLRTwOX0' },
  ],
}

export const deployments: Topic = {
  id: 'deployments',
  title: 'Despliegues seguros y recuperación',
  subtitle: 'Rolling, blue/green, canary, feature flags, migraciones expand/contract, rollback automático y DR',
  domain: 'reliability',
  icon: '🚀',
  track: 'java',
  pos: { x: 30, y: 40 },
  prerequisites: ['reliability', 'observability'],
  minutes: 24,
  blocks: [
    { type: 'p', text: 'La mayoría de los incidentes de producción los provoca un cambio: un despliegue, una configuración, una migración. En una plataforma de pagos, **desplegar sin downtime y poder volver atrás en minutos** es un requisito, no un lujo.' },
    { type: 'h', text: 'Estrategias de despliegue' },
    { type: 'table', head: ['Estrategia', 'Cómo funciona', 'Pros', 'Contras'], rows: [
      ['Rolling', 'Reemplaza instancias de a poco', 'Simple, sin infraestructura extra (default de Kubernetes)', 'Conviven versiones; rollback lento'],
      ['Blue/green', 'Dos entornos completos; se cambia el tráfico de golpe', 'Rollback instantáneo', 'Doble costo durante el cambio; todos los usuarios a la vez'],
      ['Canary', '1% → 5% → 25% → 50% → 100% comparando métricas', 'Limita el radio de impacto; decisiones con datos', 'Requiere buena observabilidad y análisis'],
      ['Feature flags', 'El código se despliega apagado y se activa por segmento', 'Separa desplegar de lanzar; kill switch', 'Deuda si no se limpian'],
    ] },
    { type: 'h', text: 'Canary bien hecho' },
    { type: 'list', items: [
      'Compara el canary **contra la versión estable al mismo tiempo**, no contra ayer: tasa de error, p95/p99, saturación y métricas de negocio (tasa de aprobación de pagos).',
      'Con poco tráfico hay **mucho ruido**: espera un tiempo mínimo por paso (o un número mínimo de peticiones) antes de decidir.',
      '**Rollback automático** si se supera un umbral (Argo Rollouts, Flagger, AWS CodeDeploy, Cloud Deploy).',
      'Enrutamiento inteligente: primero tráfico interno, luego un país o un segmento de comercios, luego el resto.',
    ] },
    { type: 'h', text: 'Migraciones de base de datos sin downtime: expand/contract' },
    { type: 'list', ordered: true, items: [
      '**Expand**: añade la columna/tabla nueva (nullable, sin bloquear). El código viejo la ignora.',
      'Despliega código que **escribe en ambas** (vieja y nueva) y sigue leyendo la vieja.',
      '**Backfill** en lotes de los datos históricos.',
      'Cambia las **lecturas** a la nueva (detrás de un feature flag).',
      '**Contract**: deja de escribir en la vieja y, días después, elimínala.',
    ] },
    { type: 'callout', tone: 'warn', text: 'Cada paso debe ser compatible con la versión anterior del código: durante un rolling o un canary conviven ambas. Un `ALTER TABLE` que bloquea la tabla de pagos 4 minutos es un incidente.' },
    { type: 'h', text: 'Recuperación ante desastres (DR)' },
    { type: 'table', head: ['Estrategia', 'RTO', 'RPO', 'Costo'], rows: [
      ['Backup & restore', 'Horas', 'Horas', '$'],
      ['Pilot light (BD replicada, cómputo apagado)', '10–60 min', 'Minutos', '$$'],
      ['Warm standby (región secundaria reducida)', 'Minutos', 'Segundos', '$$$'],
      ['Activo-activo multi-región', '~0', '~0 (con conflictos que resolver)', '$$$$'],
    ] },
    { type: 'list', items: [
      '[[rpo-rto|RPO]]: cuántos datos puedes perder. RTO: cuánto puedes tardar en volver.',
      'Un plan de DR que nunca se ensaya no existe: haz **game days** y simulacros de failover.',
      'Rollback de código es fácil; de datos, no: por eso migraciones compatibles y backups probados.',
    ] },
    { type: 'callout', tone: 'interview', text: '"Diseño asumiendo el fallo": cada despliegue es canary con análisis automático contra la estable; las migraciones son expand/contract; los lanzamientos van detrás de feature flags con kill switch; y el DR es warm standby con failover ensayado cada trimestre, RPO de segundos y RTO de minutos.' },
  ],
  cloud: [
    { concept: 'Canary / blue-green gestionado', aws: 'CodeDeploy, App Mesh / ALB weighted target groups', azure: 'Container Apps revisions, Front Door, AKS + Flagger', gcp: 'Cloud Deploy, Cloud Run traffic splitting' },
    { concept: 'Feature flags', aws: 'AppConfig feature flags', azure: 'App Configuration feature manager', gcp: 'Firebase Remote Config / OpenFeature + proveedor' },
    { concept: 'DR multi-región', aws: 'Aurora Global Database, Route 53 failover', azure: 'Geo-replicación, Traffic Manager / Front Door', gcp: 'Spanner multi-región, Cloud DNS / Global LB' },
  ],
  realWorld: [
    { company: 'Google', title: 'Canarying en SRE', text: 'El SRE Workbook dedica un capítulo al canarying: comparar contra un control, elegir métricas y duración, y automatizar la evaluación.' },
    { company: 'Knight Capital', title: '440 M USD en 45 minutos (2012)', text: 'Un despliegue manual dejó código viejo activo en uno de ocho servidores; sin rollback rápido ni kill switch, la empresa perdió 440 millones de dólares.' },
    { company: 'Facebook / Meta', title: 'Gatekeeper', text: 'Todo se lanza detrás de flags con despliegue progresivo por porcentaje, país o empleados primero.' },
  ],
  interview: {
    questions: ['¿Cómo desplegarías una versión nueva del servicio de pagos sin downtime?', '¿Cómo harías un cambio de esquema en una tabla de 2.000 millones de filas?', 'Diferencia entre blue/green y canary.', '¿Qué estrategia de DR propondrías y con qué RPO/RTO?'],
    tips: ['Canary con análisis automático contra la estable.', 'Expand/contract compatible hacia atrás.', 'Separar desplegar de lanzar con feature flags.'],
    redFlags: ['Desplegar al 100% de golpe un viernes.', 'Migraciones que bloquean tablas en caliente.', 'Un plan de DR que nunca se probó.'],
  },
  quiz: [
    { kind: 'single', q: 'Quieres limitar el impacto de un bug a pocos usuarios y decidir con métricas. ¿Estrategia?', options: ['Rolling', 'Blue/green', 'Canary', 'Big bang'], answer: 2, explain: 'Canary expone la versión nueva a un porcentaje pequeño y la compara contra la estable.' },
    { kind: 'single', q: 'Al 1% de tráfico el canary muestra 1,5% de error vs 0,5% de la estable tras 5 segundos. ¿Qué haces?', options: ['Rollback inmediato sin dudar', 'Esperar más muestras: con tan poco tráfico el ruido es enorme', 'Subir al 100%', 'Ignorarlo'], answer: 1, explain: 'Con ~100 peticiones, 1 error más cambia el porcentaje. Un tiempo de observación mínimo evita falsas alarmas.' },
    { kind: 'order', q: 'Ordena una migración expand/contract para renombrar una columna:', items: ['Añadir la columna nueva', 'Escribir en ambas columnas', 'Backfill de datos históricos', 'Leer de la nueva', 'Eliminar la vieja'], explain: 'Cada paso es compatible con la versión anterior del código.' },
    { kind: 'single', q: 'RPO de 5 minutos significa…', options: ['Volver a funcionar en 5 minutos', 'Perder como mucho 5 minutos de datos', '5 minutos de downtime al mes', '5 réplicas'], answer: 1, explain: 'RPO = pérdida de datos aceptable; RTO = tiempo de recuperación.' },
    { kind: 'multi', q: '¿Qué hace seguro un despliegue en pagos?', options: ['Canary con rollback automático', 'Feature flags con kill switch', 'Migraciones compatibles hacia atrás', 'Desplegar sin métricas para ir más rápido'], answers: [0, 1, 2], explain: 'Sin métricas no hay forma de saber si el canary está sano.' },
  ],
  flashcards: [
    { id: 'dp-1', front: 'Blue/green vs canary', back: 'Blue/green: cambio total instantáneo y rollback instantáneo. Canary: por porcentajes comparando métricas.' },
    { id: 'dp-2', front: 'Expand/contract', back: 'Añadir → escribir en ambas → backfill → leer la nueva → eliminar la vieja.' },
    { id: 'dp-3', front: 'Qué comparar en un canary', back: 'Error rate, p95/p99, saturación y KPIs de negocio, contra la estable al mismo tiempo.' },
    { id: 'dp-4', front: 'Feature flag', back: 'Separar desplegar de lanzar; activar por segmento; kill switch. Limpiar flags viejos.' },
    { id: 'dp-5', front: 'Estrategias de DR', back: 'Backup/restore → pilot light → warm standby → activo-activo (más rápido y más caro).' },
  ],
  resources: [
    { title: 'Google SRE Workbook: Canarying Releases', url: 'https://sre.google/workbook/canarying-releases/' },
    { title: 'Argo Rollouts: Canary', url: 'https://argoproj.github.io/argo-rollouts/features/canary/' },
    { title: 'Martin Fowler: Parallel Change (expand/contract)', url: 'https://martinfowler.com/bliki/ParallelChange.html' },
    { title: 'AWS: Disaster Recovery of Workloads on AWS', url: 'https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html' },
  ],
}

export const leadership: Topic = {
  id: 'leadership',
  title: 'Liderazgo técnico y entrevista C-level',
  subtitle: 'STAR, costo-beneficio, deuda técnica, post-mortems sin culpables, colaboración global e inglés técnico',
  domain: 'leadership',
  icon: '👑',
  track: 'java',
  pos: { x: 50, y: 40 },
  prerequisites: [],
  minutes: 20,
  blocks: [
    { type: 'p', text: 'En la ronda final no se evalúa si sabes Kafka, sino **cómo decides, cómo comunicas y cómo aprendes**. El panel quiere respuestas breves, estructuradas, honestas y conectadas con el negocio.' },
    { type: 'h', text: 'Método STAR' },
    { type: 'table', head: ['Parte', 'Qué cuentas', 'Duración'], rows: [
      ['**S**ituación', 'El contexto mínimo: empresa, sistema, problema', '1–2 frases'],
      ['**T**area', 'Tu responsabilidad concreta', '1 frase'],
      ['**A**cción', 'Lo que TÚ hiciste (en primera persona) y por qué', 'La mayor parte'],
      ['**R**esultado', 'Impacto medible: dinero, latencia, incidentes, tiempo', '1–2 frases con números'],
    ] },
    { type: 'callout', tone: 'tip', title: 'Prepara 5 historias antes de la entrevista', text: '1) Un incidente crítico que lideraste. 2) Una decisión técnica difícil (y su costo-beneficio). 3) Deuda técnica que lograste pagar sin frenar al negocio. 4) Un desacuerdo con producto o con otro equipo. 5) Un error tuyo y qué cambiaste. Escríbelas en la sección "Historias STAR" de la ruta.' },
    { type: 'h', text: 'Decisiones con criterio de negocio' },
    { type: 'list', items: [
      '**Costo-beneficio explícito**: costo (personas × meses, riesgo, costo de oportunidad) vs beneficio (ingresos, ahorro, incidentes evitados, velocidad de entrega).',
      '**Decisiones reversibles vs irreversibles** ("puertas de dos sentidos"): las reversibles se toman rápido; las irreversibles, con más análisis.',
      '**Monolito → microservicios**: no por moda. Empieza por el dominio con más dolor medible con el patrón [[strangler|strangler fig]], mide y decide si seguir.',
      '**Nuevas herramientas**: prueba de concepto acotada, criterios de éxito definidos antes, costo de operación y de aprendizaje, salida si falla.',
      'Documenta las decisiones en **ADRs** (Architecture Decision Records): contexto, opciones, decisión y consecuencias.',
    ] },
    { type: 'h', text: 'Deuda técnica, gestionada' },
    { type: 'list', items: [
      'Hazla **visible**: un registro de deuda con impacto (incidentes, horas perdidas, riesgo) y costo estimado.',
      'Hazla **negociable**: tradúcela a lenguaje de negocio ("este módulo causa 3 incidentes al mes y frena 2 días cada entrega").',
      '**Capacidad reservada** y sostenible (p. ej. 15–20% de cada sprint) en lugar de "un trimestre de refactor" que nunca llega.',
      'Paga primero la deuda que está en el camino de lo que el negocio necesita ahora.',
    ] },
    { type: 'h', text: 'Post-mortems sin culpables' },
    { type: 'list', ordered: true, items: [
      'Resumen e impacto (usuarios, dinero, duración).',
      'Línea de tiempo con detección, mitigación y resolución.',
      'Causa raíz con los **5 porqués** y factores contribuyentes (¿por qué no lo detectamos antes?).',
      'Qué salió bien y qué salió mal.',
      '**Acciones con dueño y fecha**: salvaguardas automáticas (alertas, tests, límites, canary), no "tener más cuidado".',
    ] },
    { type: 'h', text: 'Colaboración global e inglés técnico' },
    { type: 'list', items: [
      'Equipos en México, Argentina y China: **asíncrono primero** (design docs, ADRs, demos grabadas), una ventana corta de solapamiento para decisiones y responsables claros.',
      'Escribe para ser leído en otro huso horario: contexto, decisión pedida y fecha límite en el primer párrafo.',
      'Frases útiles: "The trade-off here is…", "I would start with the simplest option that meets the SLO", "I am not familiar with X, but this is how I would approach it", "The root cause was…, and the safeguard we added is…", "Let me summarize the decision and the next steps".',
    ] },
    { type: 'callout', tone: 'interview', text: 'Honestidad intelectual: si no sabes algo, dilo y explica cómo lo aprenderías. Es mucho mejor valorado que divagar. Y conecta siempre la técnica con el usuario y el negocio.' },
  ],
  cloud: [
    { concept: 'Costo de la infraestructura (FinOps)', aws: 'Cost Explorer, Budgets, Compute Optimizer', azure: 'Cost Management + Advisor', gcp: 'Billing reports, Recommender' },
    { concept: 'Gestión de incidentes', aws: 'Incident Manager (Systems Manager)', azure: 'Azure Monitor alerts + action groups', gcp: 'Cloud Monitoring incidents' },
  ],
  realWorld: [
    { company: 'Google', title: 'Cultura de post-mortem', text: 'El libro de SRE de Google describe los post-mortems sin culpables como base para aprender de los fallos sin miedo.' },
    { company: 'Amazon', title: 'Puertas de un sentido y de dos', text: 'Jeff Bezos distingue decisiones irreversibles (análisis cuidadoso) de reversibles (decidir rápido), para no frenar a la organización.' },
    { company: 'Shopify', title: 'Monolito modular', text: 'Shopify eligió modularizar su monolito Rails en lugar de migrar todo a microservicios: una decisión de costo-beneficio documentada públicamente.' },
  ],
  interview: {
    questions: ['Cuéntame de un incidente crítico que lideraste.', '¿Cómo decides si migrar un monolito a microservicios?', '¿Cómo equilibras deuda técnica y funcionalidades?', 'Tell me about a time you disagreed with a product decision.', '¿Cómo trabajarías con un equipo en China con 14 horas de diferencia?'],
    tips: ['STAR en 1–2 minutos, resultado con números.', 'Costo-beneficio y decisiones reversibles.', 'Admite lo que no sabes y explica cómo aprenderías.'],
    redFlags: ['Culpar a otros en un post-mortem.', 'Respuestas de 10 minutos sin estructura.', 'Proponer reescribirlo todo desde cero.'],
  },
  quiz: [
    { kind: 'order', q: 'Ordena una respuesta STAR:', items: ['Situación: contexto en una frase', 'Tarea: tu responsabilidad', 'Acción: lo que hiciste y por qué', 'Resultado: impacto medible'], explain: 'Situación → Tarea → Acción → Resultado.' },
    { kind: 'single', q: '¿Cuál es el mejor "Resultado" para una historia STAR?', options: ['"Todo salió bien y el equipo quedó contento"', '"Bajamos el p99 de 2 s a 300 ms y los reclamos cayeron un 40% en un mes"', '"Usamos Kafka y Kubernetes"', '"Fue un proyecto muy complejo"'], answer: 1, explain: 'Números y efecto en el usuario o el negocio.' },
    { kind: 'single', q: 'Un post-mortem bien cerrado termina con…', options: ['El nombre del culpable', 'Un correo pidiendo más cuidado', 'Acciones con dueño y fecha que hagan imposible o detectable el mismo fallo', 'Nada: ya se resolvió'], answer: 2, explain: 'Blameless y con salvaguardas concretas y seguimiento.' },
    { kind: 'single', q: 'Producto pide 5 funcionalidades y la deuda técnica causa incidentes semanales. ¿Mejor enfoque?', options: ['Solo funcionalidades', 'Parar todo y refactorizar 6 meses', 'Cuantificar el costo de la deuda, priorizar con producto y reservar capacidad fija', 'Esconder el trabajo de deuda dentro de las funcionalidades'], answer: 2, explain: 'Visible, cuantificada, negociada y sostenible.' },
    { kind: 'multi', q: 'Para colaborar con equipos en varios husos horarios conviene…', options: ['Documentación escrita y ADRs', 'Demos grabadas', 'Una ventana corta de solapamiento para decisiones', 'Reuniones diarias a las 2 a. m. para un equipo'], answers: [0, 1, 2], explain: 'Asíncrono primero y respeto por los horarios.' },
  ],
  flashcards: [
    { id: 'ld-1', front: 'STAR', back: 'Situación, Tarea, Acción (la mayor parte, en primera persona), Resultado (con números).' },
    { id: 'ld-2', front: 'Post-mortem sin culpables: 5 partes', back: 'Impacto, línea de tiempo, causa raíz (5 porqués), qué salió bien/mal, acciones con dueño y fecha.' },
    { id: 'ld-3', front: 'Deuda técnica: cómo negociarla', back: 'Registro con impacto en negocio + capacidad reservada (15–20%) + priorizar la que bloquea lo que viene.' },
    { id: 'ld-4', front: 'Puertas de un sentido / dos sentidos', back: 'Irreversibles: analiza con cuidado. Reversibles: decide rápido y aprende.' },
    { id: 'ld-5', front: 'Frase para no saber algo (en inglés)', back: '"I am not familiar with X, but this is how I would approach it…"' },
  ],
  resources: [
    { title: 'Google SRE Book: Postmortem Culture', url: 'https://sre.google/sre-book/postmortem-culture/' },
    { title: 'Martin Fowler: Technical Debt Quadrant', url: 'https://martinfowler.com/bliki/TechnicalDebtQuadrant.html' },
    { title: 'Martin Fowler: Strangler Fig Application', url: 'https://martinfowler.com/bliki/StranglerFigApplication.html' },
    { title: 'ADR GitHub organization (plantillas)', url: 'https://adr.github.io/' },
    { title: 'Will Larson: Staff Engineer', url: 'https://staffeng.com/' },
  ],
}
