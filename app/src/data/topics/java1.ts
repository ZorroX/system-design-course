import type { Topic } from '../types'
import tpJava from '@labs/java/ThreadPools.java?raw'
import tpPy from '@labs/python/thread_pools.py?raw'
import inJava from '@labs/java/Incidents.java?raw'
import inPy from '@labs/python/incidents.py?raw'
import lkJava from '@labs/java/Locking.java?raw'
import lkPy from '@labs/python/locking.py?raw'
import pfJava from '@labs/java/PaymentFlow.java?raw'
import pfPy from '@labs/python/payment_flow.py?raw'

/* ============================================================================
 * Ruta "Entrevista Java Backend · Pagos" — Etapa 1: fundamentos, diagnóstico e idempotencia
 * ========================================================================== */

export const springJvm: Topic = {
  id: 'spring-jvm',
  title: 'Spring Boot y la JVM por dentro',
  subtitle: 'Ciclo de vida de beans, inyección de dependencias, proxies, @Transactional, memoria y GC',
  domain: 'java',
  icon: '🍃',
  track: 'java',
  pos: { x: 10, y: 10 },
  prerequisites: [],
  minutes: 25,
  blocks: [
    { type: 'p', text: 'En la entrevista no te preguntarán anotaciones de memoria: te pedirán explicar **qué hace Spring cuando arranca**, por qué un `@Transactional` "no funciona" y qué pasa en la memoria de la JVM cuando el servicio se degrada. Esto es lo que separa a quien usa el framework de quien lo opera en producción.' },
    { type: 'h', text: 'Inyección de dependencias (DI)' },
    { type: 'p', text: 'Tu clase declara lo que necesita y el contenedor (el `ApplicationContext`) se lo entrega. Así puedes cambiar implementaciones y probar con dobles sin tocar el código.' },
    { type: 'list', items: [
      '**Por constructor** (recomendada): dependencias `final`, objeto siempre válido, fácil de testear. Con un solo constructor ni siquiera hace falta `@Autowired`.',
      '**Por setter**: para dependencias opcionales.',
      '**Por campo** (`@Autowired` en el atributo): cómoda pero oculta dependencias y complica los tests. Evítala en código nuevo.',
      'Varias implementaciones del mismo tipo: `@Primary` o `@Qualifier("nombre")`.',
      'Dependencias circulares: Spring Boot 2.6+ las prohíbe por defecto. Son un olor de diseño; se rompen extrayendo un tercer componente o publicando eventos.',
    ] },
    { type: 'code', lang: 'java', title: 'Inyección por constructor (el estilo recomendado)', code: `@Service
public class ChargeService {
    private final PaymentRepository repo;
    private final AcquirerClient acquirer;

    // Un solo constructor: Spring lo usa para inyectar (no hace falta @Autowired)
    public ChargeService(PaymentRepository repo, AcquirerClient acquirer) {
        this.repo = repo;
        this.acquirer = acquirer;
    }
}` },
    { type: 'h', text: 'Ciclo de vida de un bean' },
    { type: 'list', ordered: true, items: [
      '**Definición**: Spring escanea (`@Component`, `@Service`, `@Bean`) y registra las definiciones.',
      '**Instanciación**: llama al constructor (aquí ocurre la inyección por constructor).',
      '**Población de propiedades**: inyección por setter/campo.',
      '**Aware**: `BeanNameAware`, `ApplicationContextAware`… si las implementas.',
      '**BeanPostProcessor (antes)** → **inicialización**: `@PostConstruct`, `afterPropertiesSet()` o `initMethod`.',
      '**BeanPostProcessor (después)**: aquí se crean los **proxies** (AOP) para `@Transactional`, `@Async`, `@Cacheable`, `@Retryable`.',
      '**En uso** hasta que se cierra el contexto → **destrucción**: `@PreDestroy`, `destroy()`. Úsalo para cerrar pools y hacer graceful shutdown.',
    ] },
    { type: 'table', head: ['Scope', 'Instancias', 'Uso típico'], rows: [
      ['singleton (por defecto)', 'Una por contexto', 'Servicios sin estado. ¡Deben ser thread-safe!'],
      ['prototype', 'Una por cada inyección/getBean', 'Objetos con estado de corta vida'],
      ['request / session', 'Una por petición HTTP / sesión', 'Datos de la petición en aplicaciones web'],
    ] },
    { type: 'callout', tone: 'warn', title: 'Las trampas de @Transactional (pregunta clásica)', text: '1) **Auto-invocación**: si `metodoA()` llama a `this.metodoB()` anotado, la llamada no pasa por el proxy y NO hay transacción. 2) Solo funciona en métodos **públicos** llamados desde fuera del bean. 3) Por defecto hace rollback solo con excepciones **unchecked** (`RuntimeException`); para checked usa `rollbackFor`. 4) Llamar a un servicio HTTP externo dentro de una transacción mantiene una conexión de BD abierta mientras esperas: saca las llamadas remotas fuera.' },
    { type: 'h', text: 'La memoria de la JVM' },
    { type: 'table', head: ['Zona', 'Qué guarda', 'Error típico'], rows: [
      ['Heap · Young (Eden + Survivor)', 'Objetos recién creados; la mayoría muere joven', 'GC menores muy frecuentes'],
      ['Heap · Old', 'Objetos que sobrevivieron varios GC', '`OutOfMemoryError: Java heap space`'],
      ['Metaspace', 'Metadatos de clases', '`OutOfMemoryError: Metaspace` (fugas de classloaders)'],
      ['Stack de cada hilo', 'Frames y variables locales (~1 MB por hilo)', '`StackOverflowError`; miles de hilos = mucha memoria'],
      ['Memoria nativa / directa', 'Buffers NIO, Netty, JNI', 'El contenedor muere con OOMKilled (exit 137) sin error Java'],
    ] },
    { type: 'list', items: [
      '**G1** es el [[gc|GC]] por defecto: buen equilibrio entre throughput y pausas. **ZGC/Shenandoah**: pausas de milisegundos con heaps enormes (Java 17/21).',
      'En contenedores usa `-XX:MaxRAMPercentage=75` en lugar de un `-Xmx` fijo, y deja margen para memoria nativa y stacks.',
      'Siempre en producción: `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps` y logs de GC (`-Xlog:gc*`).',
      'Fugas típicas: colecciones estáticas que solo crecen, cachés sin expiración, `ThreadLocal` que no se limpian en pools, listeners nunca desregistrados.',
    ] },
    { type: 'callout', tone: 'interview', text: 'Si te preguntan por memoria, enlaza síntoma → herramienta → causa: "p99 sube y hay Full GC seguidos; jstat muestra Old al 99% tras cada GC; el histograma muestra millones de X; el heap dump en MAT revela un HashMap estático sin TTL". Esa cadena demuestra experiencia real.' },
  ],
  cloud: [
    { concept: 'Ejecutar Spring Boot', aws: 'ECS/Fargate, EKS, Elastic Beanstalk, App Runner', azure: 'Azure Container Apps, AKS, Azure Spring Apps', gcp: 'Cloud Run, GKE' },
    { concept: 'Perfilado continuo de la JVM', aws: 'CodeGuru Profiler', azure: 'Application Insights Profiler', gcp: 'Cloud Profiler' },
    { concept: 'Configuración externa / secretos', aws: 'Parameter Store, Secrets Manager', azure: 'App Configuration, Key Vault', gcp: 'Secret Manager' },
  ],
  realWorld: [
    { company: 'Netflix', title: 'Spring Boot a escala', text: 'Netflix migró gran parte de su backend Java a Spring Boot y mantiene Spring Cloud Netflix y DGS (GraphQL) sobre él.' },
    { company: 'Alibaba / Ant Group', title: 'JVMs a escala de Singles Day', text: 'Mantienen su propia distribución de OpenJDK (Dragonwell) con mejoras de arranque y GC para picos de cientos de miles de transacciones por segundo.' },
  ],
  interview: {
    questions: ['Explica el ciclo de vida de un bean de Spring.', '¿Por qué un método @Transactional llamado desde la misma clase no abre transacción?', 'Tu servicio se queda sin memoria cada 3 horas. ¿Qué haces paso a paso?', '¿Qué scope tiene un bean por defecto y qué implica para la concurrencia?'],
    tips: ['Menciona los proxies (AOP) al hablar de @Transactional/@Async.', 'Constructor injection + final.', 'Siempre HeapDumpOnOutOfMemoryError en producción.'],
    redFlags: ['"Subo el -Xmx" como única respuesta a una fuga.', 'Guardar estado mutable en un singleton sin sincronización.', 'Llamadas HTTP dentro de una transacción de BD.'],
  },
  quiz: [
    { kind: 'single', q: '`saveAll()` llama a `this.saveOne()`, anotado con @Transactional. ¿Qué pasa?', options: ['Se abre una transacción por cada saveOne', 'No hay transacción: la auto-invocación no pasa por el proxy', 'Spring lanza una excepción al arrancar', 'Se usa la transacción de saveAll si existe'], answer: 1, explain: 'Spring aplica @Transactional con un proxy. Una llamada interna (this.x()) no atraviesa el proxy. Si saveAll no es transaccional, no hay transacción.' },
    { kind: 'single', q: '¿En qué fase del ciclo de vida se crean los proxies de AOP?', options: ['En el constructor', 'En @PostConstruct', 'En el BeanPostProcessor posterior a la inicialización', 'Al destruir el bean'], answer: 2, explain: 'postProcessAfterInitialization envuelve el bean en un proxy (transacciones, async, caché).' },
    { kind: 'single', q: 'Un método @Transactional lanza una IOException (checked). Por defecto…', options: ['Hace rollback', 'Hace commit', 'Lanza UnexpectedRollbackException', 'Depende del motor de BD'], answer: 1, explain: 'Por defecto solo RuntimeException y Error provocan rollback. Usa @Transactional(rollbackFor = Exception.class) si lo necesitas.' },
    { kind: 'multi', q: '¿Cuáles son causas típicas de fugas de memoria en Java?', options: ['Un Map estático que solo crece', 'ThreadLocal sin remove() en un thread pool', 'Usar G1 en vez de ZGC', 'Listeners registrados y nunca eliminados'], answers: [0, 1, 3], explain: 'El tipo de GC no causa fugas: los objetos siguen alcanzables desde una raíz y nunca se liberan.' },
    { kind: 'single', q: 'Tu pod muere con OOMKilled (exit 137) pero no hay OutOfMemoryError en el log. ¿Qué sospechas?', options: ['El heap está lleno', 'La memoria total del proceso (heap + nativa + stacks) superó el límite del contenedor', 'Un deadlock', 'El GC está desactivado'], answer: 1, explain: 'El kernel mata el proceso por la memoria total. Deja margen: MaxRAMPercentage ~75% y revisa memoria nativa con -XX:NativeMemoryTracking.' },
  ],
  flashcards: [
    { id: 'sj-1', front: 'Ciclo de vida de un bean (resumen)', back: 'Instanciar → inyectar → Aware → BPP antes → @PostConstruct → BPP después (proxies) → uso → @PreDestroy.' },
    { id: 'sj-2', front: '¿Por qué inyección por constructor?', back: 'Dependencias final y explícitas, objeto siempre válido, tests sin Spring.' },
    { id: 'sj-3', front: '3 trampas de @Transactional', back: 'Auto-invocación, métodos no públicos, rollback solo con unchecked por defecto.' },
    { id: 'sj-4', front: 'Flags JVM imprescindibles en producción', back: '-XX:MaxRAMPercentage, -XX:+HeapDumpOnOutOfMemoryError, -XX:HeapDumpPath, -Xlog:gc*.' },
    { id: 'sj-5', front: 'Singleton y concurrencia', back: 'Un bean singleton lo usan todos los hilos a la vez: sin estado mutable o con estructuras thread-safe.' },
  ],
  resources: [
    { title: 'Spring Framework: The IoC Container', url: 'https://docs.spring.io/spring-framework/reference/core/beans.html' },
    { title: 'Spring: Using @Transactional (proxies y self-invocation)', url: 'https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html' },
    { title: 'Oracle: HotSpot GC Tuning Guide', url: 'https://docs.oracle.com/en/java/javase/21/gctuning/' },
    { title: 'Baeldung: Spring Bean Lifecycle', url: 'https://www.baeldung.com/spring-bean-lifecycle' },
  ],
}

export const concurrency: Topic = {
  id: 'concurrency',
  title: 'Concurrencia y thread pools en Java',
  subtitle: 'Hilos, locks, ThreadPoolExecutor, dimensionado, colas, rechazo, CompletableFuture e hilos virtuales',
  domain: 'java',
  icon: '🧵',
  track: 'java',
  pos: { x: 30, y: 10 },
  prerequisites: ['spring-jvm'],
  minutes: 28,
  blocks: [
    { type: 'p', text: 'Un servicio de pagos atiende miles de peticiones a la vez. Cada una ocupa un hilo de Tomcat, una conexión del pool de base de datos y quizás un hilo de un executor propio. **Dimensionar mal un pool** es una de las causas más comunes de incidentes: demasiado pequeño y las peticiones esperan; demasiado grande y la base de datos o la CPU colapsan.' },
    { type: 'h', text: 'Lo básico que debes dominar' },
    { type: 'list', items: [
      '**Race condition**: dos hilos leen-modifican-escriben el mismo dato y uno pisa al otro. `count++` NO es atómico.',
      '`synchronized` / `ReentrantLock`: exclusión mutua. `ReentrantLock` añade `tryLock(timeout)`, equidad y varias condiciones.',
      '`volatile`: visibilidad entre hilos (no atomicidad). `AtomicLong`, `LongAdder`: contadores sin locks.',
      '`ConcurrentHashMap`: mapa thread-safe; usa `compute`/`merge` para operaciones atómicas por clave.',
      '**Deadlock**: espera circular por candados. Se evita adquiriéndolos siempre en el mismo orden o con `tryLock` y timeout.',
    ] },
    { type: 'h', text: 'Cómo decide ThreadPoolExecutor' },
    { type: 'list', ordered: true, items: [
      'Si hay menos de **corePoolSize** hilos → crea un hilo nuevo.',
      'Si no → intenta **encolar** la tarea.',
      'Si la cola está llena y hay menos de **maximumPoolSize** hilos → crea un hilo extra.',
      'Si no → aplica la **RejectedExecutionHandler** (Abort, CallerRuns, Discard, DiscardOldest).',
    ] },
    { type: 'callout', tone: 'warn', title: 'La trampa de Executors', text: '`Executors.newFixedThreadPool(n)` usa una `LinkedBlockingQueue` **sin límite**: maximumPoolSize nunca entra en juego y, en un pico, la cola crece hasta el `OutOfMemoryError`. `newCachedThreadPool` hace lo contrario: hilos ilimitados. En producción crea el `ThreadPoolExecutor` explícitamente con una cola acotada.' },
    { type: 'code', lang: 'java', title: 'Un pool de producción con Spring', code: `@Bean
public ThreadPoolTaskExecutor acquirerExecutor() {
    ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
    ex.setCorePoolSize(40);          // I/O: núcleos × (1 + espera/cálculo)
    ex.setMaxPoolSize(80);
    ex.setQueueCapacity(200);        // ¡acotada!
    ex.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy()); // backpressure
    ex.setThreadNamePrefix("acquirer-");   // nombres útiles en jstack
    ex.setWaitForTasksToCompleteOnShutdown(true);
    ex.setAwaitTerminationSeconds(20);     // graceful shutdown
    return ex;
}` },
    { type: 'h', text: 'Dimensionar un pool' },
    { type: 'table', head: ['Tipo de trabajo', 'Regla', 'Ejemplo (8 núcleos)'], rows: [
      ['CPU (cálculo, cifrado, JSON enorme)', 'hilos ≈ núcleos (+1)', '8–9 hilos'],
      ['I/O (HTTP a un adquirente, BD)', 'hilos ≈ núcleos × (1 + espera / cálculo)', '5 ms CPU + 95 ms espera → 8 × 20 = 160'],
      ['Por [[littles-law|Ley de Little]]', 'concurrencia = tasa × latencia', '400 req/s × 0,1 s = 40 en vuelo'],
    ] },
    { type: 'list', items: [
      '**Pool de conexiones a BD (HikariCP)**: pequeño. Una base con 8 núcleos rinde mejor con ~20 conexiones que con 200. Varias instancias × pool = conexiones totales: cuídalo.',
      '**Tomcat**: `server.tomcat.threads.max=200` por defecto. Si los hilos esperan al pool de BD, subir Tomcat no sirve.',
      '**Bulkhead**: un pool distinto por dependencia, para que un adquirente lento no consuma los hilos de todo lo demás.',
      '**CompletableFuture**: pásale tu executor (`supplyAsync(task, executor)`). El `ForkJoinPool.commonPool()` está pensado para CPU, no para I/O bloqueante.',
    ] },
    { type: 'h', text: 'Hilos virtuales (Java 21)' },
    { type: 'tradeoff', left: { title: 'Ayudan cuando…', items: ['El código es bloqueante y hace mucho I/O', 'Quieres un hilo por petición sin pools gigantes', 'Spring Boot 3.2+: spring.threads.virtual.enabled=true'] }, right: { title: 'No ayudan cuando…', items: ['El trabajo es CPU puro', 'El cuello de botella es la BD (siguen necesitando límites: un Semaphore o el tamaño del pool)', 'Hay synchronized largos que "fijan" (pinning) el hilo portador (mejorado en Java 24)'] } },
    { type: 'callout', tone: 'interview', text: 'KISS: no propongas hilos virtuales, colas o reactivo "por moda". Di primero cuántas peticiones por segundo, cuánto espera cada una y cuántas conexiones aguanta la BD; de ahí sale el tamaño del pool. Luego menciona cola acotada, política de rechazo y métricas (activeCount, queue size, rejected).' },
  ],
  simulator: 'thread-pool',
  simIntro: 'Configura un ThreadPoolExecutor real (core, max, cola y política de rechazo) y míralo trabajar bajo un pico, con trabajo de I/O y de CPU.',
  code: { title: 'Pools, rechazo, deadlocks e hilos virtuales', java: tpJava, python: tpPy, runJava: 'java labs/java/ThreadPools.java', runPython: 'python labs/python/thread_pools.py',
    notes: ['Compara 4, 16 y 64 hilos con trabajo de I/O: la Ley de Little en acción.', 'AbortPolicy rechaza; CallerRunsPolicy hace que el hilo que envía ejecute la tarea (frena al productor).', 'ThreadMXBean.findDeadlockedThreads() es lo mismo que usa jstack para detectar deadlocks.', 'Python: el GIL impide paralelismo de CPU con hilos; para CPU se usan procesos.'] },
  cloud: [
    { concept: 'Métricas del pool (Micrometer)', aws: 'CloudWatch / Managed Prometheus', azure: 'Azure Monitor / Managed Prometheus', gcp: 'Cloud Monitoring', note: 'executor.active, executor.queued, hikaricp.connections.pending' },
    { concept: 'Escalar por saturación', aws: 'ECS/EKS autoscaling con métricas custom', azure: 'KEDA en AKS / Container Apps', gcp: 'GKE HPA con métricas custom / Cloud Run concurrency' },
  ],
  realWorld: [
    { company: 'Netflix', title: 'Hystrix → bulkheads', text: 'Hystrix popularizó aislar cada dependencia en su propio thread pool para que una lenta no tumbara el resto. Hoy se usa Resilience4j (@Bulkhead).' },
    { company: 'HikariCP', title: 'Pools pequeños', text: 'La guía "About Pool Sizing" de HikariCP muestra con pruebas de Oracle que reducir el pool de 2048 a 96 conexiones bajó la latencia de ~100 ms a ~2 ms.' },
  ],
  interview: {
    questions: ['¿Cómo dimensionarías el thread pool que llama al adquirente?', '¿Qué pasa con Executors.newFixedThreadPool en un pico?', 'Diferencia entre synchronized, ReentrantLock y volatile.', '¿Cuándo usarías hilos virtuales y cuándo no?'],
    tips: ['Fórmula de Goetz o Ley de Little con números.', 'Cola acotada + política de rechazo explícita.', 'Un pool por dependencia (bulkhead).'],
    redFlags: ['"Pongo 1000 hilos por si acaso".', 'Pool de BD más grande para "arreglar" consultas lentas.', 'Usar el commonPool para I/O bloqueante.'],
  },
  quiz: [
    { kind: 'single', q: 'ThreadPoolExecutor con core=10, max=50 y una LinkedBlockingQueue sin límite. ¿Cuántos hilos llegará a tener?', options: ['50', '10', 'Ilimitados', 'Depende de los núcleos'], answer: 1, explain: 'Solo crea hilos por encima de core cuando la cola está llena. Una cola sin límite nunca se llena: max no se usa.' },
    { kind: 'single', q: 'Cada petición usa 10 ms de CPU y espera 90 ms a un servicio externo. Con 4 núcleos, ¿cuántos hilos aprox.?', options: ['4', '8', '40', '400'], answer: 2, explain: 'núcleos × (1 + espera/cálculo) = 4 × (1 + 9) = 40.' },
    { kind: 'single', q: 'El pool está saturado y quieres frenar al productor en lugar de perder tareas. ¿Qué política?', options: ['AbortPolicy', 'DiscardPolicy', 'CallerRunsPolicy', 'DiscardOldestPolicy'], answer: 2, explain: 'CallerRuns ejecuta la tarea en el hilo que la envía: ese hilo deja de aceptar trabajo mientras tanto (backpressure).' },
    { kind: 'multi', q: '¿Qué evita un deadlock entre transferencias A→B y B→A?', options: ['Adquirir los locks siempre ordenados por id de cuenta', 'tryLock con timeout y reintento', 'Más hilos en el pool', 'Un único lock global (funciona pero serializa todo)'], answers: [0, 1, 3], explain: 'Orden global o timeout rompen la espera circular. El lock global también, a costa del throughput.' },
    { kind: 'single', q: 'Tu servicio CPU-bound tiene 64 hilos en 4 núcleos y el p99 empeoró. ¿Por qué?', options: ['Falta memoria', 'Los hilos compiten por la CPU y hay sobrecosto de cambios de contexto', 'El GC está apagado', 'La red es lenta'], answer: 1, explain: 'Para CPU, más hilos que núcleos no añade capacidad: cada tarea tarda más y se pierde tiempo en cambios de contexto.' },
  ],
  flashcards: [
    { id: 'cc-1', front: 'Orden de decisión de ThreadPoolExecutor', back: 'core → cola → max → rechazo.' },
    { id: 'cc-2', front: 'Fórmula de Goetz', back: 'hilos ≈ núcleos × (1 + tiempo de espera / tiempo de cálculo).' },
    { id: 'cc-3', front: 'Problema de newFixedThreadPool', back: 'Cola sin límite: un pico la llena hasta OutOfMemoryError.' },
    { id: 'cc-4', front: 'volatile vs synchronized', back: 'volatile: visibilidad. synchronized: visibilidad + exclusión mutua (atomicidad del bloque).' },
    { id: 'cc-5', front: 'Hilos virtuales: ¿cuándo?', back: 'I/O bloqueante con mucha concurrencia. No para CPU, y siguen necesitando límites hacia la BD.' },
  ],
  resources: [
    { title: 'Java Concurrency in Practice (Goetz) — cap. 8: Applying Thread Pools', url: 'https://jcip.net/' },
    { title: 'JDK 21: ThreadPoolExecutor (javadoc)', url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html' },
    { title: 'HikariCP: About Pool Sizing', url: 'https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing' },
    { title: 'JEP 444: Virtual Threads', url: 'https://openjdk.org/jeps/444' },
  ],
}

export const troubleshooting: Topic = {
  id: 'troubleshooting',
  title: 'Diagnóstico en producción (Linux + JVM)',
  subtitle: 'CPU al 100%, fugas de memoria, hilos bloqueados: top, jstack, jstat, jcmd, heap dumps y MAT',
  domain: 'java',
  icon: '🩺',
  track: 'java',
  pos: { x: 50, y: 10 },
  prerequisites: ['concurrency'],
  minutes: 26,
  blocks: [
    { type: 'p', text: 'La pregunta llega así: "Son las 3 a. m., el servicio de cobros está al 100% de CPU. ¿Qué haces?". Lo que quieren oír no es "reviso los logs" ni "reinicio", sino **comandos concretos, en orden, con lo que buscas en cada salida**. Aquí tienes los tres runbooks que debes saber de memoria.' },
    { type: 'callout', tone: 'tip', title: 'Primero mitiga, pero sin perder la evidencia', text: 'Si el impacto es alto, saca la instancia del balanceador (o haz rollback) **antes** de reiniciarla, y captura 2–3 thread dumps y, si es memoria, un heap dump. Reiniciar borra el estado que explica el fallo.' },
    { type: 'h', text: 'Runbook 1 · CPU al 100%' },
    { type: 'code', lang: 'bash', code: `top                                  # ¿qué proceso? (PID 4242, 396% CPU)
top -H -p 4242                       # ¿qué HILOS? (TID 4311 al 99%)
printf '%x\\n' 4311                   # → 10d7 (jstack usa hexadecimal)
jstack 4242 | grep -A 20 'nid=0x10d7' # ¿qué ejecuta ese hilo?
# Alternativas: jcmd 4242 Thread.print · async-profiler (flame graph) · JFR` },
    { type: 'list', items: [
      'Si los hilos calientes son de **GC** ("G1 Conc", "GC Thread") → es memoria, no código: pasa al runbook 2.',
      'Toma **2–3 dumps separados 5–10 s**: si el mismo hilo está en el mismo método, es tu culpable.',
      'Culpables típicos: bucles infinitos, regex con backtracking catastrófico, serialización de objetos enormes, `HashMap` concurrente corrupto (Java 7).',
    ] },
    { type: 'h', text: 'Runbook 2 · Fuga de memoria / GC excesivo' },
    { type: 'code', lang: 'bash', code: `jstat -gcutil 4242 1000             # O (Old) al 99% incluso tras Full GC (FGC sube) = fuga
jcmd 4242 GC.class_histogram | head  # ¿QUÉ crece? (equivale a jmap -histo:live)
jcmd 4242 GC.heap_dump /tmp/h.hprof  # foto del heap (o jmap -dump:live,format=b,file=...)
# Analizar en Eclipse MAT: Leak Suspects → Dominator Tree → Path to GC Roots
# Memoria nativa: -XX:NativeMemoryTracking=summary + jcmd 4242 VM.native_memory` },
    { type: 'list', items: [
      'Diferencia clave: `OutOfMemoryError` (la JVM se queda sin heap) vs **OOMKilled / exit 137** (el contenedor supera su límite total).',
      'El histograma te dice **qué** se acumula; el heap dump te dice **quién** lo retiene (la referencia desde una GC root: un campo estático, un ThreadLocal…).',
      'Un heap dump pausa la JVM y pesa tanto como el heap: hazlo en una instancia fuera del balanceador.',
    ] },
    { type: 'h', text: 'Runbook 3 · CPU baja pero todo está lento (hilos bloqueados)' },
    { type: 'code', lang: 'bash', code: `jstack 4242 > dump1.txt              # ¿en qué estado están TODOS los hilos?
grep -c 'HikariPool.getConnection' dump1.txt   # muchos esperando conexión → pool agotado
tail -f app.log | grep -i 'Connection is not available'
# En la BD: SELECT * FROM pg_stat_activity WHERE state <> 'idle';
#           pg_stat_statements → EXPLAIN (ANALYZE, BUFFERS) de la consulta culpable
# Deadlock Java: al final del jstack aparece "Found one Java-level deadlock"` },
    { type: 'table', head: ['Estado en jstack', 'Significa', 'Busca'], rows: [
      ['RUNNABLE', 'Ejecutando (o en I/O nativo)', 'El método en la cima: ¿CPU o socketRead?'],
      ['BLOCKED', 'Esperando un monitor (synchronized)', '"waiting to lock <0x…>" y quién lo tiene'],
      ['WAITING / TIMED_WAITING', 'Esperando una condición, un pool, un sleep', 'getConnection, Future.get, LockSupport.park'],
    ] },
    { type: 'h', text: 'Utilitarios del sistema que conviene nombrar' },
    { type: 'table', head: ['Comando', 'Para qué'], rows: [
      ['`vmstat 1` / `iostat -x 1`', 'CPU en espera de disco (wa), saturación de disco'],
      ['`free -m`, `dmesg | grep -i oom`', 'Memoria del SO y procesos matados por el OOM killer'],
      ['`ss -s`, `ss -tanp | grep 8080`', 'Conexiones TCP: ESTABLISHED, TIME_WAIT, CLOSE_WAIT (fugas de conexiones)'],
      ['`lsof -p PID | wc -l`', 'Descriptores abiertos (fugas de archivos/sockets)'],
      ['`/actuator/threaddump`, `/actuator/heapdump`, `/actuator/metrics`', 'Lo mismo desde Spring Boot Actuator (protegido)'],
    ] },
    { type: 'callout', tone: 'interview', text: 'Estructura tu respuesta: (1) confirmar impacto con métricas, (2) mitigar sin perder evidencia, (3) runbook con comandos, (4) causa raíz, (5) arreglo + salvaguarda (alerta, test, límite) y post-mortem sin culpables.' },
  ],
  simulator: 'jvm-terminal',
  simIntro: 'Una terminal de guardia con 4 incidentes reales. Ejecuta comandos, lee las salidas como en un servidor Linux y diagnostica la causa raíz con la menor cantidad de pasos.',
  code: { title: 'Incidentes reales para practicar con jstack, jstat y jcmd', java: inJava, python: inPy, runJava: 'java labs/java/Incidents.java cpu', runPython: 'python labs/python/incidents.py cpu',
    notes: ['Sin argumentos hace un autodiagnóstico rápido de los 4 incidentes y termina.', 'Con cpu / leak / deadlock / pool se queda corriendo: abre otra terminal y usa jps, top -H, jstack, jstat, jcmd.', 'Python: py-spy dump --pid PID es el equivalente de jstack; tracemalloc, el de un histograma de memoria.'] },
  cloud: [
    { concept: 'Perfilado continuo', aws: 'CodeGuru Profiler', azure: 'Application Insights Profiler', gcp: 'Cloud Profiler' },
    { concept: 'Acceso al contenedor para diagnosticar', aws: 'ECS Exec / kubectl exec en EKS', azure: 'az containerapp exec / kubectl exec', gcp: 'kubectl exec en GKE' },
    { concept: 'Almacenar heap dumps', aws: 'S3', azure: 'Blob Storage', gcp: 'Cloud Storage' },
  ],
  realWorld: [
    { company: 'Cloudflare', title: 'La regex que tumbó la red (2019)', text: 'Una regla del WAF con una regex de backtracking catastrófico llevó la CPU al 100% en todo el mundo durante 27 minutos. El post-mortem es lectura obligada.' },
    { company: 'Netflix', title: 'Flame graphs', text: 'Brendan Gregg popularizó los flame graphs en Netflix para encontrar en segundos qué código consume la CPU en producción.' },
  ],
  interview: {
    questions: ['El servicio está al 100% de CPU. ¿Qué comandos ejecutas y en qué orden?', '¿Cómo distingues una fuga de memoria de un heap simplemente pequeño?', 'CPU al 5% pero el 40% de las peticiones da timeout. ¿Qué miras?', '¿Qué es un heap dump y cómo lo analizas?'],
    tips: ['top -H → printf %x → jstack, de memoria.', 'jstat -gcutil para ver si Old baja tras Full GC.', 'Captura evidencia antes de reiniciar.'],
    redFlags: ['"Reinicio el servicio y listo".', '"Reviso los logs" sin decir qué buscas.', 'Subir el heap o el pool sin conocer la causa.'],
  },
  quiz: [
    { kind: 'order', q: 'Ordena el runbook para encontrar el código que quema CPU:', items: ['top (proceso)', 'top -H -p PID (hilo)', "printf '%x' TID (a hexadecimal)", 'jstack PID | grep nid=0x… (qué ejecuta)'], explain: 'Proceso → hilo → id en hexadecimal → stack de ese hilo.' },
    { kind: 'single', q: '`jstat -gcutil` muestra Old al 99,8% y FGC aumentando cada segundo. ¿Qué indica?', options: ['Todo normal', 'Fuga de memoria: los objetos sobreviven a los Full GC', 'Demasiados hilos', 'Disco lleno'], answer: 1, explain: 'Si tras un Full GC la generación vieja sigue llena, hay objetos alcanzables que nunca se liberan.' },
    { kind: 'single', q: '¿Qué herramienta te dice QUIÉN retiene la memoria filtrada?', options: ['top', 'El histograma de clases', 'El heap dump analizado en MAT (dominadores y camino a GC roots)', 'vmstat'], answer: 2, explain: 'El histograma dice qué clase crece; el árbol de dominadores y el path to GC roots dicen quién la retiene.' },
    { kind: 'single', q: 'jstack: 180 hilos en TIMED_WAITING dentro de HikariPool.getConnection. ¿Siguiente paso?', options: ['Subir el pool a 500', 'Ver qué consultas retienen las conexiones (pg_stat_activity / pg_stat_statements) y su EXPLAIN', 'Subir los hilos de Tomcat', 'Reiniciar'], answer: 1, explain: 'El pool agotado es el síntoma; la causa suele ser una consulta lenta o una conexión que no se devuelve.' },
    { kind: 'multi', q: 'Antes de reiniciar una instancia degradada deberías…', options: ['Sacarla del balanceador', 'Tomar 2–3 thread dumps', 'Tomar un heap dump si es memoria', 'Borrar los logs para liberar disco'], answers: [0, 1, 2], explain: 'Mitigas el impacto y conservas la evidencia para la causa raíz.' },
  ],
  flashcards: [
    { id: 'ts-1', front: 'Runbook CPU 100%', back: "top → top -H -p PID → printf '%x' TID → jstack PID | grep nid=0x…" },
    { id: 'ts-2', front: 'Runbook fuga de memoria', back: 'jstat -gcutil → jcmd GC.class_histogram → jcmd GC.heap_dump → MAT (dominator tree, GC roots).' },
    { id: 'ts-3', front: 'OutOfMemoryError vs OOMKilled', back: 'El primero: heap de la JVM. El segundo: el contenedor superó su límite total (exit 137).' },
    { id: 'ts-4', front: 'CPU baja + timeouts', back: 'Los hilos esperan algo: pool de conexiones, locks, servicio externo. jstack y estados WAITING/BLOCKED.' },
    { id: 'ts-5', front: 'Cómo ver un deadlock Java', back: 'jstack: al final "Found one Java-level deadlock" con los hilos y monitores implicados.' },
  ],
  resources: [
    { title: 'Oracle: Troubleshooting Guide (Java SE)', url: 'https://docs.oracle.com/en/java/javase/21/troubleshoot/' },
    { title: 'Eclipse Memory Analyzer (MAT)', url: 'https://eclipse.dev/mat/' },
    { title: 'async-profiler', url: 'https://github.com/async-profiler/async-profiler' },
    { title: 'Cloudflare: Details of the outage on July 2, 2019 (regex)', url: 'https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/' },
    { title: 'Brendan Gregg: Linux Performance', url: 'https://www.brendangregg.com/linuxperf.html' },
  ],
}

export const sqlTuning: Topic = {
  id: 'sql-tuning',
  title: 'SQL lento, índices y bloqueos',
  subtitle: 'EXPLAIN ANALYZE, índices compuestos, N+1, aislamiento y bloqueo optimista vs. pesimista',
  domain: 'data',
  icon: '🗄️',
  track: 'java',
  pos: { x: 70, y: 10 },
  prerequisites: ['databases'],
  minutes: 26,
  blocks: [
    { type: 'p', text: 'La mayoría de los incidentes de "el servicio está lento" terminan en una consulta. El flujo profesional es siempre el mismo: **encontrar** la consulta (slow log o `pg_stat_statements`), **entender** su plan con `EXPLAIN ANALYZE`, **arreglar** con el índice correcto o reescribiéndola, y **verificar** con el plan nuevo.' },
    { type: 'h', text: 'Leer un plan de ejecución' },
    { type: 'code', lang: 'sql', code: `EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM payments
WHERE merchant_id = 'm_8812' AND status = 'CAPTURED'
ORDER BY created_at DESC LIMIT 50;

-- Limit (actual time=8391..8391 rows=50)
--   -> Sort (Sort Key: created_at DESC)
--     -> Seq Scan on payments (rows=4100) (actual rows=4210)
--          Filter: merchant_id = 'm_8812' AND status = 'CAPTURED'
--          Rows Removed by Filter: 48113559      <-- ¡leyó 48 M filas!` },
    { type: 'table', head: ['En el plan', 'Qué significa'], rows: [
      ['Seq Scan', 'Lee la tabla entera. Malo en tablas grandes con filtros selectivos'],
      ['Index Scan / Index Only Scan', 'Usa un índice (Only: no toca la tabla, el índice "cubre" la consulta)'],
      ['Bitmap Heap Scan', 'Combina índices para muchas filas'],
      ['Nested Loop / Hash Join / Merge Join', 'Estrategias de JOIN; Nested Loop con muchas filas externas suele doler'],
      ['rows estimadas vs actual', 'Si difieren mucho, estadísticas viejas: ANALYZE'],
      ['Rows Removed by Filter', 'Filas leídas y descartadas: trabajo desperdiciado'],
    ] },
    { type: 'h', text: 'Índices que de verdad sirven' },
    { type: 'list', items: [
      '**Compuesto en el orden correcto**: primero las columnas de **igualdad**, luego las de **rango u orden**. Para la consulta de arriba: `(merchant_id, status, created_at)`.',
      '**Prefijo izquierdo**: un índice `(a, b, c)` sirve para `a`, `a,b` y `a,b,c`, pero no para `b` sola.',
      '**Selectividad**: indexar `status` (5 valores) casi nunca ayuda; `merchant_id` sí.',
      '**Covering index**: incluye las columnas del SELECT (`INCLUDE (amount)` en Postgres) y evita leer la tabla.',
      'Lo que **rompe** un índice: funciones sobre la columna (`WHERE DATE(created_at) = …`, `LOWER(email)`) salvo índice de expresión, conversiones implícitas de tipo, `LIKE \'%texto\'`.',
      'Cada índice **cuesta en escrituras** y espacio. En tablas enormes, créalo con `CREATE INDEX CONCURRENTLY` (Postgres) para no bloquear.',
      '**Paginación**: `OFFSET 100000` lee y descarta 100 000 filas. Usa keyset: `WHERE created_at < :ultimo ORDER BY created_at DESC LIMIT 50`.',
    ] },
    { type: 'callout', tone: 'warn', title: 'El N+1 de JPA', text: 'Cargas 100 pedidos y, al recorrerlos, Hibernate lanza 1 consulta por pedido para traer sus pagos: 101 consultas. Se detecta activando el log de SQL o con métricas de consultas por petición, y se arregla con `JOIN FETCH`, `@EntityGraph` o `@BatchSize`.' },
    { type: 'h', text: 'Concurrencia en la base de datos' },
    { type: 'tradeoff', left: { title: 'Bloqueo optimista', items: ['Columna `version`; `UPDATE … WHERE id = ? AND version = ?`', 'JPA: `@Version` → `OptimisticLockException` si otro ganó', 'Sin esperas; ideal con poca contención', 'Necesita reintentos'] }, right: { title: 'Bloqueo pesimista', items: ['`SELECT … FOR UPDATE` bloquea la fila hasta el commit', 'JPA: `@Lock(PESSIMISTIC_WRITE)`', 'Ideal con alta contención (cuenta de un gran comercio)', 'Riesgo de esperas y deadlocks: bloquea siempre en el mismo orden'] } },
    { type: 'list', items: [
      'Para un descuento simple, lo más simple es un **UPDATE atómico condicional**: `UPDATE accounts SET balance = balance - :m WHERE id = :id AND balance >= :m` (0 filas = fondos insuficientes).',
      '`SELECT … FOR UPDATE SKIP LOCKED`: varios workers toman trabajos de una tabla-cola sin pisarse.',
      '**Niveles de aislamiento**: Postgres usa READ COMMITTED por defecto; MySQL InnoDB, REPEATABLE READ. El *lost update* aparece con leer-modificar-escribir en READ COMMITTED si no bloqueas o versionas.',
      '**Deadlocks en BD**: la base detecta el ciclo y aborta una transacción; reintenta y ordena los bloqueos (por id).',
    ] },
    { type: 'callout', tone: 'interview', text: 'Responde con el ciclo completo: "Identifico la consulta con pg_stat_statements, veo en EXPLAIN ANALYZE un Seq Scan con 48 M filas descartadas, creo CONCURRENTLY un índice (merchant_id, status, created_at DESC), verifico que pasa a Index Scan y monitoreo el p99". KISS: un índice antes que una caché o una cola.' },
  ],
  simulator: 'explain',
  simIntro: 'Elige el índice para cada consulta y mira cómo cambia el plan de ejecución, las filas leídas y la latencia. Luego, resuelve un lost update.',
  code: { title: 'EXPLAIN real con SQLite y bloqueos optimista/pesimista', java: lkJava, python: lkPy, runJava: 'java labs/java/Locking.java', runPython: 'python labs/python/locking.py',
    notes: ['Python usa sqlite3 (incluido): verás SCAN vs SEARCH USING INDEX con 300.000 filas reales.', 'Java simula en memoria el lost update, el bloqueo pesimista y el optimista con versión + CAS.', 'En Postgres: EXPLAIN (ANALYZE, BUFFERS); en MySQL 8: EXPLAIN ANALYZE.'] },
  cloud: [
    { concept: 'Consultas lentas', aws: 'RDS/Aurora Performance Insights, slow query log', azure: 'Query Performance Insight, Query Store', gcp: 'Cloud SQL Query Insights' },
    { concept: 'Postgres gestionado', aws: 'RDS for PostgreSQL / Aurora PostgreSQL', azure: 'Azure Database for PostgreSQL Flexible Server', gcp: 'Cloud SQL / AlloyDB' },
  ],
  realWorld: [
    { company: 'GitLab', title: 'Índices concurrentes', text: 'GitLab documenta en su guía de migraciones que todos los índices sobre tablas grandes se crean con CONCURRENTLY y en migraciones separadas, para no bloquear escrituras en producción.' },
    { company: 'Stripe', title: 'Migraciones online', text: 'Stripe describe cómo migra tablas de miles de millones de filas sin downtime: doble escritura, backfill y cambio de lecturas por pasos.' },
  ],
  interview: {
    questions: ['¿Cómo encuentras y arreglas una consulta lenta en producción?', '¿Qué índice crearías para WHERE a = ? AND b = ? ORDER BY c?', 'Bloqueo optimista vs pesimista: ¿cuándo cada uno?', '¿Qué es el problema N+1 y cómo lo resuelves en JPA?'],
    tips: ['pg_stat_statements → EXPLAIN ANALYZE → índice → verificar.', 'Igualdades primero, luego orden/rango.', 'UPDATE atómico condicional para saldos.'],
    redFlags: ['Indexar cada columna por separado.', 'Más conexiones en el pool para "arreglar" una consulta lenta.', 'Leer saldo, restarlo en Java y escribirlo sin bloqueo ni versión.'],
  },
  quiz: [
    { kind: 'single', q: 'Consulta: `WHERE merchant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50`. ¿Mejor índice?', options: ['(created_at)', '(status)', '(merchant_id, status, created_at)', '(created_at, status, merchant_id)'], answer: 2, explain: 'Igualdades primero y la columna de orden al final: el índice entrega las 50 filas ya ordenadas.' },
    { kind: 'single', q: 'Tienes índice (merchant_id, status). ¿Cuál de estas consultas NO lo puede usar eficientemente?', options: ['WHERE merchant_id = ?', 'WHERE merchant_id = ? AND status = ?', 'WHERE status = ?', 'WHERE merchant_id = ? ORDER BY status'], answer: 2, explain: 'Regla del prefijo izquierdo: sin la primera columna, el índice no sirve para buscar.' },
    { kind: 'single', q: '`WHERE DATE(created_at) = \'2026-11-01\'` con índice en created_at…', options: ['Usa el índice', 'No usa el índice por la función sobre la columna; reescribe como rango', 'Es más rápido que un rango', 'Da error'], answer: 1, explain: 'Usa created_at >= \'2026-11-01\' AND created_at < \'2026-11-02\' (o un índice de expresión).' },
    { kind: 'single', q: 'Edición de perfiles de usuario: conflictos rarísimos. ¿Qué estrategia?', options: ['SELECT FOR UPDATE siempre', 'Bloqueo optimista con @Version', 'Un lock global en Java', 'Nivel SERIALIZABLE en toda la base'], answer: 1, explain: 'Con poca contención, el optimista evita esperas; el raro conflicto se reintenta.' },
    { kind: 'multi', q: '¿Qué señales en un EXPLAIN ANALYZE indican un problema?', options: ['Seq Scan con millones de "Rows Removed by Filter"', 'Estimación de filas muy distinta de las reales', 'Index Only Scan', 'Nested Loop con cientos de miles de iteraciones'], answers: [0, 1, 3], explain: 'Index Only Scan suele ser lo ideal.' },
  ],
  flashcards: [
    { id: 'sq-1', front: 'Orden de columnas en un índice compuesto', back: 'Igualdades primero, luego rango/orden. Prefijo izquierdo.' },
    { id: 'sq-2', front: 'Encontrar consultas lentas en Postgres', back: 'pg_stat_statements (total_exec_time, mean_exec_time) y log_min_duration_statement.' },
    { id: 'sq-3', front: 'Bloqueo optimista en JPA', back: '@Version; UPDATE … WHERE version = ?; OptimisticLockException → reintentar.' },
    { id: 'sq-4', front: 'Descuento de saldo seguro y simple', back: 'UPDATE accounts SET balance = balance - :m WHERE id = :id AND balance >= :m.' },
    { id: 'sq-5', front: 'N+1', back: '1 consulta + N consultas por cada fila. JOIN FETCH, @EntityGraph o @BatchSize.' },
  ],
  resources: [
    { title: 'Use The Index, Luke! (Markus Winand)', url: 'https://use-the-index-luke.com/' },
    { title: 'PostgreSQL: Using EXPLAIN', url: 'https://www.postgresql.org/docs/current/using-explain.html' },
    { title: 'PostgreSQL: Explicit Locking', url: 'https://www.postgresql.org/docs/current/explicit-locking.html' },
    { title: 'Vlad Mihalcea: Optimistic vs pessimistic locking', url: 'https://vladmihalcea.com/optimistic-vs-pessimistic-locking/' },
  ],
}

export const paymentsConsistency: Topic = {
  id: 'payments-consistency',
  title: 'Idempotencia y consistencia en pagos',
  subtitle: 'Timeouts con el adquirente, idempotency keys con hash, estados, ledger, outbox y conciliación',
  domain: 'distributed',
  icon: '💳',
  track: 'java',
  pos: { x: 90, y: 10 },
  prerequisites: ['api-design'],
  minutes: 28,
  blocks: [
    { type: 'p', text: 'La pregunta estrella de una entrevista en una fintech: **"La conexión con el adquirente se corta en el último milisegundo. ¿Cobraste o no? ¿Cómo proteges el saldo del usuario?"**. La respuesta madura combina cinco piezas: idempotencia, estados explícitos, una sola transacción local, conciliación y simplicidad.' },
    { type: 'h', text: '1 · Idempotency key + hash del payload' },
    { type: 'list', ordered: true, items: [
      'El cliente genera una clave (UUID) por **operación lógica** y la envía en `Idempotency-Key`. Reintentos de la misma operación → misma clave.',
      'El servidor calcula el hash (SHA-256) del cuerpo canónico e inserta `(clave, hash, EN_CURSO)` con **restricción UNIQUE**, en la misma transacción que crea el pago.',
      'Si el INSERT choca: mismo hash y COMPLETADO → devuelve la **respuesta guardada**; mismo hash y EN_CURSO → **409** (reintenta luego); hash distinto → **422** (clave reutilizada para otra cosa).',
      'Las claves expiran con un TTL mayor que la ventana de reintentos (Stripe: 24 h).',
    ] },
    { type: 'code', lang: 'sql', title: 'La tabla que lo hace posible (KISS: sin locks distribuidos)', code: `CREATE TABLE idempotency_keys (
  merchant_id   TEXT        NOT NULL,
  key           TEXT        NOT NULL,
  request_hash  CHAR(64)    NOT NULL,
  status        TEXT        NOT NULL,          -- IN_PROGRESS | COMPLETED
  response_code INT,
  response_body JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, key)               -- la UNIQUE resuelve la carrera del doble clic
);` },
    { type: 'h', text: '2 · Un timeout no es un "no"' },
    { type: 'table', head: ['Estado', 'Significa', 'Siguiente paso'], rows: [
      ['CREADO / EN_CURSO', 'Enviado al adquirente', 'Esperar respuesta (con timeout)'],
      ['CAPTURADO', 'El adquirente confirmó', 'Asientos en el ledger + evento por outbox'],
      ['FALLIDO', 'Rechazo **explícito** del adquirente', 'El cliente puede reintentar con clave nueva'],
      ['DESCONOCIDO / PENDIENTE', 'Timeout o error de red', 'Consultar estado con la MISMA referencia, webhook o conciliación'],
    ] },
    { type: 'list', items: [
      'Propaga tu propia referencia/idempotency key al adquirente: así **él** deduplica tus reintentos.',
      'Reintenta con **backoff y jitter**, siempre con la misma referencia. Nunca con una nueva.',
      'Al usuario: "Pago en proceso". Mejor unos minutos de espera que un doble cargo.',
      '**Conciliación** diaria contra el archivo de liquidación del adquirente: resuelve los pendientes y detecta diferencias.',
    ] },
    { type: 'h', text: '3 · Dinero bien guardado' },
    { type: 'list', items: [
      '**Centavos en enteros** (`long`/`BIGINT`) o `BigDecimal`/`NUMERIC`. Nunca `double`/`FLOAT`.',
      '**Ledger de doble partida**, inmutable (append-only): cada movimiento son asientos que suman cero. El saldo es una proyección (materializada con un UPDATE atómico).',
      'Una sola **transacción local**: estado del pago + asientos + fila en la tabla **outbox**. Un relay o CDC publica el evento después ([[outbox|transactional outbox]]).',
      'Webhooks y eventos llegan **al menos una vez**: deduplica por id de evento y permite cada transición de estado una sola vez.',
      'Autorizar y capturar por separado (hold): reservas fondos al crear el pedido y capturas al confirmar.',
    ] },
    { type: 'callout', tone: 'tip', title: 'KISS en pagos', text: 'Una restricción UNIQUE, una máquina de estados y una transacción ACID resuelven el 90% del problema. No hace falta Kafka, Redis ni locks distribuidos para el camino feliz: añádelos solo cuando un requisito (escala, desacoplamiento) lo justifique con números.' },
    { type: 'callout', tone: 'interview', text: 'Guion de 60 segundos: "El cliente envía Idempotency-Key; la guardo con el hash del payload con UNIQUE en la misma transacción que el pago EN_CURSO. Llamo al adquirente con mi referencia. Si hay timeout, el pago queda PENDIENTE y lo resuelvo consultando con la misma referencia, por webhook o por conciliación; nunca lo marco fallido a ciegas. Montos en centavos, ledger de doble partida y outbox para eventos."' },
  ],
  simulator: 'payment-timeout',
  simIntro: 'Activa protecciones (idempotency key, hash, misma referencia al adquirente, estado PENDIENTE, conciliación) y lanza 30 pagos con una red que falla. Cuenta dobles cargos y pagos perdidos.',
  code: { title: 'Timeouts, estado desconocido, ledger y conciliación', java: pfJava, python: pfPy, runJava: 'java labs/java/PaymentFlow.java', runPython: 'python labs/python/payment_flow.py',
    notes: ['La estrategia ingenua genera dobles cargos reales cuando la respuesta se pierde.', 'La segura usa la misma referencia, consulta el estado y concilia al final: cero dobles cargos y el ledger siempre suma 0.', 'El lab de Idempotencia del tema "APIs" implementa el almacén de claves con hash del payload.'] },
  cloud: [
    { concept: 'Base transaccional', aws: 'Aurora PostgreSQL (Multi-AZ)', azure: 'Azure Database for PostgreSQL (zona redundante)', gcp: 'Cloud SQL / AlloyDB / Spanner' },
    { concept: 'Ledger inmutable', aws: 'Aurora + tablas append-only (QLDB fue descontinuado)', azure: 'Azure SQL Ledger tables', gcp: 'Spanner / AlloyDB append-only' },
    { concept: 'Webhooks y eventos', aws: 'EventBridge, SQS', azure: 'Event Grid, Service Bus', gcp: 'Eventarc, Pub/Sub' },
  ],
  realWorld: [
    { company: 'Stripe', title: 'Idempotency keys', text: 'Stripe guarda la respuesta de cada clave durante 24 h y devuelve error si se reutiliza con parámetros distintos. Su post sobre idempotencia es la referencia del patrón.' },
    { company: 'Uber', title: 'Gulfstream / ledger de pagos', text: 'Uber reescribió su plataforma de pagos alrededor de un ledger con garantías de exactamente una vez a nivel de negocio, usando idempotencia en cada paso.' },
    { company: 'Airbnb', title: 'Orpheus', text: 'Airbnb creó una librería de idempotencia (Orpheus) para que cada llamada de pagos pueda reintentarse con seguridad, separando fases pre-RPC, RPC y post-RPC.' },
  ],
  interview: {
    questions: ['La conexión con el procesador se corta tras enviar el cobro. ¿Qué haces?', '¿Cómo implementas idempotencia en POST /payments?', '¿Cómo evitas que dos réplicas procesen el mismo doble clic?', '¿Cómo modelas los saldos?'],
    tips: ['Timeout = estado desconocido, no fallido.', 'UNIQUE en la base: atómico y simple.', 'Centavos enteros, ledger de doble partida, outbox, conciliación.'],
    redFlags: ['Reintentar con una referencia nueva.', 'SELECT y luego INSERT para comprobar la clave.', 'FLOAT para dinero.', 'Proponer Kafka + Redis + ZooKeeper para un doble clic.'],
  },
  quiz: [
    { kind: 'single', q: 'Llega una petición con una Idempotency-Key ya usada, el mismo hash y el cobro COMPLETADO. Respuesta correcta:', options: ['Cobrar de nuevo', 'Devolver la respuesta guardada', '409 Conflict', '422'], answer: 1, explain: 'Es un reintento de la misma operación: se devuelve lo mismo sin repetir el efecto.' },
    { kind: 'single', q: 'Misma clave pero con otro monto:', options: ['Procesar el nuevo monto', 'Devolver la respuesta anterior', '422: la clave se reutilizó con otro payload', 'Ignorar'], answer: 2, explain: 'El hash del payload no coincide: es un error del cliente. No se cobra.' },
    { kind: 'single', q: 'Timeout con el adquirente. ¿Qué estado asignas?', options: ['FALLIDO', 'CAPTURADO', 'PENDIENTE/DESCONOCIDO hasta consultar o conciliar', 'CANCELADO'], answer: 2, explain: 'No sabes si cobró. Marcarlo fallido invita a un doble cargo.' },
    { kind: 'single', q: 'Dos réplicas reciben a la vez la misma clave. ¿Mecanismo más simple y correcto?', options: ['SELECT; si no existe, INSERT', 'INSERT con restricción UNIQUE (o PRIMARY KEY)', 'Un HashMap en memoria', 'Un lock distribuido con ZooKeeper'], answer: 1, explain: 'La restricción de unicidad de la base es atómica. SELECT-luego-INSERT tiene una carrera; el HashMap no se comparte entre réplicas.' },
    { kind: 'multi', q: '¿Qué prácticas protegen la consistencia financiera?', options: ['Montos en centavos (enteros)', 'Ledger de doble partida inmutable', 'Outbox en la misma transacción', 'Guardar saldos en double para precisión'], answers: [0, 1, 2], explain: 'double introduce errores de redondeo: nunca para dinero.' },
  ],
  flashcards: [
    { id: 'pc-1', front: 'Idempotency key: 3 respuestas según el caso', back: 'Completado y mismo hash → respuesta guardada. En curso → 409. Otro hash → 422.' },
    { id: 'pc-2', front: 'Timeout con el adquirente', back: 'Estado PENDIENTE; consultar con la misma referencia; webhook; conciliación. Nunca "fallido" a ciegas.' },
    { id: 'pc-3', front: 'Por qué UNIQUE y no SELECT+INSERT', back: 'La restricción es atómica; SELECT+INSERT tiene una carrera entre réplicas.' },
    { id: 'pc-4', front: 'Ledger de doble partida', back: 'Cada movimiento = asientos que suman 0; inmutable; el saldo es una proyección.' },
    { id: 'pc-5', front: 'Conciliación', back: 'Comparar tu registro con el archivo de liquidación del adquirente (T+1) para cerrar pendientes y detectar diferencias.' },
  ],
  resources: [
    { title: 'Stripe: Designing robust and predictable APIs with idempotency', url: 'https://stripe.com/blog/idempotency' },
    { title: 'Brandur Leach: Implementing Stripe-like Idempotency Keys in Postgres', url: 'https://brandur.org/idempotency-keys' },
    { title: 'Airbnb: Avoiding Double Payments in a Distributed Payments System', url: 'https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb' },
    { title: 'IETF draft: The Idempotency-Key HTTP Header Field', url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/' },
    { title: 'Martin Kleppmann: Designing Data-Intensive Applications (cap. 7 y 12)', url: 'https://dataintensive.net/' },
  ],
}
