/**
 * Rutas de preparación para entrevistas concretas. Cada etapa enlaza temas del curso,
 * pruebas de NIMBUS, casos de entrevista, el Design Lab y tareas de práctica manuales.
 */
import type { PuzzleId } from '@/store/game'

export type PathItem =
  | { kind: 'topic'; id: string; why: string }
  | { kind: 'puzzle'; id: PuzzleId | 'boss'; why: string }
  | { kind: 'case'; id: string; why: string }
  | { kind: 'lab'; id: string; why: string }
  | { kind: 'check'; id: string; label: string; why: string }

export interface Drill {
  q: string
  outline: string[]
}

export interface PathStage {
  id: string
  label: string
  title: string
  icon: string
  focus: { title: string; text: string }[]
  items: PathItem[]
  hints: string[]
  drills: Drill[]
}

export interface InterviewPath {
  id: string
  title: string
  subtitle: string
  stages: PathStage[]
}

export const JAVA_PATH: InterviewPath = {
  id: 'java-payments',
  title: 'Entrevista Java Backend & Team Lead · Pagos',
  subtitle: 'Tres rondas: fundamentos y diagnóstico, diseño distribuido y liderazgo. Sistemas financieros de alta disponibilidad, resiliencia y escala transaccional.',
  stages: [
    {
      id: 's1',
      label: 'Etapa 1',
      title: 'Fundamentos, diagnóstico en producción e idempotencia',
      icon: '🛠️',
      focus: [
        { title: 'Java Core y Spring Boot', text: 'Ciclo de vida de beans, inyección de dependencias, memoria, concurrencia y thread pools bien dimensionados.' },
        { title: 'Troubleshooting en Linux', text: 'CPU al 100%, fugas de memoria y bloqueos de hilos con top, jstack, jmap/jcmd, heap y thread dumps.' },
        { title: 'Bases de datos', text: 'Consultas lentas con EXPLAIN, indexación correcta y bloqueo optimista vs. pesimista.' },
        { title: 'Idempotencia y consistencia financiera', text: 'Timeouts con adquirentes sin cobros duplicados ni fondos perdidos: llaves únicas y hash del payload.' },
        { title: 'KISS', text: 'Resolver limpio el camino feliz antes de agregar complejidad.' },
      ],
      items: [
        { kind: 'topic', id: 'spring-jvm', why: 'Beans, DI, proxies, @Transactional y memoria de la JVM' },
        { kind: 'topic', id: 'concurrency', why: 'ThreadPoolExecutor, dimensionado, rechazo y deadlocks' },
        { kind: 'topic', id: 'troubleshooting', why: 'Runbooks con comandos reales' },
        { kind: 'topic', id: 'sql-tuning', why: 'EXPLAIN ANALYZE, índices compuestos y locks' },
        { kind: 'topic', id: 'payments-consistency', why: 'La pregunta del "último milisegundo"' },
        { kind: 'topic', id: 'api-design', why: 'Idempotency keys y contratos REST' },
        { kind: 'topic', id: 'databases', why: 'ACID, índices B-tree y aislamiento' },
        { kind: 'puzzle', id: 'vault', why: 'Bóveda: idempotencia con hash + decisiones ante timeouts' },
        { kind: 'puzzle', id: 'forge', why: 'Forja: configura un ThreadPoolExecutor bajo un pico' },
        { kind: 'puzzle', id: 'tower', why: 'Torre: 4 incidentes con top, jstack, jstat, MAT y EXPLAIN' },
        { kind: 'check', id: 'j1-incidents', label: 'Ejecuté labs/java/Incidents.java cpu y lo diagnostiqué con top -H, printf y jstack en mi máquina', why: 'Quieren comandos que tú mismo hayas operado' },
        { kind: 'check', id: 'j1-pitch', label: 'Puedo explicar en voz alta el flujo de idempotencia de un cobro en 60 segundos', why: 'Seguridad transaccional ante cortes de red' },
        { kind: 'check', id: 'j1-tx', label: 'Puedo explicar 3 trampas de @Transactional y cómo dimensiono el pool de Hikari', why: 'Solidez operativa en Spring' },
      ],
      hints: [
        'Nada de teoría abstracta: comandos, herramientas y flujos concretos que hayas operado. "Reinicio" o "reviso logs" no cuentan.',
        'KISS: si una estructura estándar o un índice resuelve el problema, no agregues colas ni hilos virtuales sin un requisito que lo justifique.',
        'Prepárate para detallar cómo proteges el saldo cuando la red se corta en el último milisegundo.',
      ],
      drills: [
        { q: 'El servicio de cobros está al 100% de CPU. ¿Qué haces?', outline: ['Confirmar impacto en métricas (p99, error rate) y sacar la instancia del LB si duele.', 'top → top -H -p PID → printf "%x" TID → jstack PID | grep nid=0x…; 2–3 dumps separados.', 'Si los hilos calientes son del GC → runbook de memoria (jstat -gcutil).', 'Causa raíz (p. ej. regex catastrófica), arreglo, salvaguarda (test, límite de longitud) y post-mortem.'] },
        { q: 'La memoria crece hasta OutOfMemoryError cada pocas horas.', outline: ['jstat -gcutil: Old al 99% tras Full GC = fuga.', 'jcmd GC.class_histogram para ver qué crece.', 'jcmd GC.heap_dump (fuera del LB) → MAT: dominator tree y path to GC roots.', 'Arreglo típico: caché sin TTL → Caffeine con maximumSize/expireAfterWrite; HeapDumpOnOutOfMemoryError siempre activo.'] },
        { q: 'Una consulta de pagos por comercio tarda 8 s en producción.', outline: ['pg_stat_statements para identificarla.', 'EXPLAIN (ANALYZE, BUFFERS): Seq Scan con millones de filas descartadas.', 'CREATE INDEX CONCURRENTLY (merchant_id, status, created_at DESC).', 'Verificar el plan nuevo y el p99; no subir el pool de conexiones.'] },
        { q: 'Se corta la conexión con el adquirente tras enviar el cobro.', outline: ['Idempotency-Key + hash con UNIQUE en la misma transacción que el pago EN_CURSO.', 'Timeout = PENDIENTE, nunca FALLIDO a ciegas.', 'Consultar estado / reintentar con la MISMA referencia; webhook; conciliación T+1.', 'Centavos enteros, ledger de doble partida, outbox para eventos.'] },
        { q: '¿Cómo dimensionas el pool que llama al adquirente?', outline: ['Ley de Little: TPS × latencia = concurrencia necesaria.', 'Goetz: núcleos × (1 + espera/cálculo).', 'Cola acotada + política de rechazo explícita; bulkhead por adquirente.', 'Métricas: active, queued, rejected; Hikari pequeño y consciente del total de instancias.'] },
      ],
    },
    {
      id: 's2',
      label: 'Etapa 2',
      title: 'Diseño de sistemas distribuidos, escalabilidad y resiliencia',
      icon: '🏗️',
      focus: [
        { title: 'Microservicios', text: 'Dominios desacoplados, registro y descubrimiento, API Gateway, balanceo dinámico y justificación de cada componente.' },
        { title: 'Mensajería y eventos', text: 'Kafka/RabbitMQ por dentro: particiones, réplicas, semántica de entrega, reintentos y DLQ.' },
        { title: 'Transacciones distribuidas', text: 'Saga (orquestación vs. coreografía) paso a paso, TCC y Transactional Outbox.' },
        { title: 'Alta concurrencia y escala', text: 'Pruebas de estrés, latencia P95/P99, sharding y caché distribuida (Redis).' },
        { title: 'Resiliencia activa', text: 'Rate limiting, circuit breakers (Resilience4j), bulkheads y degradación elegante.' },
        { title: 'Despliegues seguros', text: 'Canary, lanzamientos progresivos, enrutamiento de tráfico, DR y rollback automático.' },
      ],
      items: [
        { kind: 'topic', id: 'microservices', why: 'Dominios, gateway, discovery y sagas' },
        { kind: 'topic', id: 'messaging', why: 'Kafka/RabbitMQ, consumer groups, DLQ' },
        { kind: 'topic', id: 'distributed-tx', why: 'Saga paso a paso, TCC, outbox, semánticas de entrega' },
        { kind: 'topic', id: 'reliability', why: 'Timeouts, retries con jitter, breaker y bulkhead' },
        { kind: 'topic', id: 'rate-limiting', why: 'Token bucket por comercio' },
        { kind: 'topic', id: 'caching', why: 'Redis, cache-aside y stampedes' },
        { kind: 'topic', id: 'sharding', why: 'Particionar por merchant_id' },
        { kind: 'topic', id: 'load-balancing', why: 'Balanceo dinámico y health checks' },
        { kind: 'topic', id: 'observability', why: 'P95/P99, RED, trazas y SLOs' },
        { kind: 'topic', id: 'deployments', why: 'Canary, expand/contract y DR' },
        { kind: 'puzzle', id: 'caravan', why: 'Caravanas: saga con pivote y participante TCC' },
        { kind: 'puzzle', id: 'aviary', why: 'Pajarera: canary manual y rollback automático' },
        { kind: 'puzzle', id: 'harbor', why: 'Puerto: particiones, orden por clave y consumer groups' },
        { kind: 'puzzle', id: 'boss', why: 'Viernes Negro: caché, CDN, colas, rate limit y breaker juntos' },
        { kind: 'case', id: 'payment-gateway', why: 'Entrevista simulada: pasarela de pagos (45 min)' },
        { kind: 'lab', id: 'payments', why: 'Design Lab: arma la arquitectura de pagos a 99,99%' },
        { kind: 'check', id: 'j2-numbers', label: 'Tengo mis números reales: TPS, p95/p99, tamaño de datos y límites que he visto en mis sistemas', why: 'Habla con métricas y datos concretos' },
        { kind: 'check', id: 'j2-failure', label: 'Para cada componente de mi diseño sé cómo se detecta su fallo y cómo se recupera solo', why: 'Diseña asumiendo el fracaso' },
      ],
      hints: [
        'Diseña asumiendo el fracaso: explica cómo se detecta cada fallo y cómo el sistema se recupera sin intervención manual.',
        'Fundamenta cada pieza: cada base de datos, caché o broker debe resolver una necesidad cuantitativa real, no una moda.',
        'Habla con números: QPS/TPS, percentiles de latencia, tamaño de datos y límites operativos observados.',
      ],
      drills: [
        { q: 'Diseña el flujo de un pago entre microservicios.', outline: ['Saga orquestada: reservar → antifraude → cobrar (pivote) → acreditar → notificar.', 'Compensaciones idempotentes antes del pivote; reintentos hacia adelante después.', 'Outbox + Debezium para eventos; consumidores con inbox.', 'Estados explícitos y observabilidad por paso (trazas con trace_id).'] },
        { q: '¿Kafka garantiza exactly-once?', outline: ['Dentro de Kafka sí (productor idempotente + transacciones en leer-procesar-escribir).', 'Hacia una base o API externa: at-least-once + consumidor idempotente.', 'acks=all, min.insync.replicas=2, RF=3; reintentos con topics de retry y DLT.'] },
        { q: 'El adquirente principal se pone lento en pleno pico.', outline: ['Timeout corto + circuit breaker (Resilience4j) por adquirente.', 'Bulkhead: pool dedicado para que no consuma todos los hilos.', 'Fallback: adquirente alternativo o degradar (cola de reintentos con PENDIENTE).', 'Alertas por p99/error rate y burn rate del SLO.'] },
        { q: '¿Cómo despliegas una versión nueva del servicio de pagos?', outline: ['Canary 1→5→25→50→100% comparando contra la estable.', 'Análisis automático (Argo Rollouts/Flagger) con umbrales y tiempo de observación.', 'Migraciones expand/contract; feature flags con kill switch.', 'Rollback automático; DR warm standby con RPO/RTO definidos.'] },
        { q: 'Necesitas soportar 10× el tráfico en el Buen Fin.', outline: ['Estimar TPS pico y recursos (hilos, conexiones, particiones).', 'Pruebas de estrés previas con perfiles reales; mirar p99, no promedios.', 'Escalado horizontal stateless, caché para lecturas, rate limiting por comercio.', 'Sharding por merchant_id si la base es el límite; pre-calentar y congelar despliegues.'] },
      ],
    },
    {
      id: 's3',
      label: 'Etapa 3',
      title: 'Liderazgo técnico, visión de negocio y colaboración global',
      icon: '👑',
      focus: [
        { title: 'Decisiones y negocio', text: 'Pensamiento sistémico y costo-beneficio: migraciones, monolito → microservicios, nuevas herramientas.' },
        { title: 'Deuda técnica', text: 'Equilibrar entregas con pago continuo de deuda, estabilidad y calidad.' },
        { title: 'Cicatrices de batalla', text: 'Autocrítica, post-mortems sin culpables y salvaguardas que evitan la repetición.' },
        { title: 'Colaboración global e inglés', text: 'Trabajo síncrono y asíncrono entre México, Argentina y China; inglés técnico fluido.' },
        { title: 'Concisión ejecutiva', text: 'Comunicar en términos de impacto, con respuestas STAR breves y transparentes.' },
      ],
      items: [
        { kind: 'topic', id: 'leadership', why: 'STAR, costo-beneficio, deuda técnica, post-mortems e inglés' },
        { kind: 'puzzle', id: 'council', why: 'Consejo: ordena historias STAR y responde al panel' },
        { kind: 'check', id: 'j3-stories', label: 'Escribí al menos 3 historias STAR completas (abajo)', why: 'Estructura y concisión' },
        { kind: 'check', id: 'j3-english', label: 'Practiqué en voz alta, en inglés, una decisión de diseño y un incidente (2 min cada uno)', why: 'Solvencia en inglés técnico' },
        { kind: 'check', id: 'j3-dontknow', label: 'Preparé cómo responder honestamente cuando no sé algo', why: 'Honestidad intelectual' },
        { kind: 'check', id: 'j3-business', label: 'Para cada historia sé decir el impacto en el usuario o el negocio con un número', why: 'Alineación con el negocio' },
      ],
      hints: [
        'Estructura y concisión: método STAR, sin verborrea.',
        'Honestidad intelectual: si no dominas algo, dilo y explica cómo lo aprenderías.',
        'Parte de la sesión es en inglés técnico: practica explicar decisiones e impacto con naturalidad.',
        'Conecta siempre la ingeniería con la experiencia del usuario y los objetivos de la empresa.',
      ],
      drills: [
        { q: 'Cuéntanos de un incidente crítico que hayas liderado.', outline: ['S: sistema, momento y impacto (usuarios, dinero).', 'T: tu rol (líder de guardia, dueño del servicio).', 'A: mitigación, diagnóstico, comunicación con negocio.', 'R: números + post-mortem blameless con acciones cerradas.'] },
        { q: '¿Migrarías el monolito a microservicios?', outline: ['Depende del dolor medible: despliegues lentos, equipos bloqueados, escalado desigual.', 'Costo-beneficio y riesgo; decisión reversible por pasos.', 'Strangler fig empezando por el dominio con más dolor; medir y decidir.', 'Documentar en un ADR.'] },
        { q: 'Tell me about a time you disagreed with a decision.', outline: ['Situation and the decision in one sentence.', 'How you brought data, not opinions.', 'Disagree and commit, or how the decision changed.', 'Result and what you learned.'] },
        { q: '¿Cómo gestionas la deuda técnica?', outline: ['Registro visible con impacto en negocio.', 'Capacidad reservada (15–20%) acordada con producto.', 'Priorizar la deuda que bloquea lo que viene.', 'Medir: incidentes, lead time, tiempo de despliegue.'] },
      ],
    },
  ],
}

export const STAR_THEMES = [
  'Incidente crítico en producción que lideré',
  'Decisión técnica difícil (costo-beneficio)',
  'Deuda técnica pagada sin frenar al negocio',
  'Desacuerdo con producto u otro equipo',
  'Un error mío y lo que cambié después',
  'Migración o modernización de un sistema',
]

export const ENGLISH_PHRASES: [string, string][] = [
  ['Presentar un trade-off', 'The trade-off here is consistency versus availability. For payments, I would choose consistency.'],
  ['Empezar simple (KISS)', 'I would start with the simplest option that meets the SLO, and only add a queue if we see the need in the numbers.'],
  ['No saber algo', 'I am not familiar with that tool, but this is how I would approach it…'],
  ['Hablar de un incidente', 'The root cause was a missing index. We mitigated by rolling back, and the safeguard we added is a query-plan check in CI.'],
  ['Dar números', 'We were handling around two thousand transactions per second, with a p99 of about four hundred milliseconds.'],
  ['Cerrar una decisión', 'Let me summarize: we agreed on option B, I will write the ADR, and we will review the metrics next Friday.'],
  ['Asumir un error', 'That was my mistake. I owned it in the post-mortem and we automated the check so it cannot happen again.'],
  ['Pedir aclaración', 'Before I design anything, can I clarify the expected volume and the latency requirements?'],
]
