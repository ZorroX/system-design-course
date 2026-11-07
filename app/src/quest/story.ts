/**
 * Historia, diálogos y códice de NIMBUS. Los textos admiten **negrita** y [[términos]] del glosario
 * (se ven con tooltip en los diálogos y el códice).
 */
import type { DialogLine } from './bus'
import { PUZZLES, TREASURY, type PuzzleId, type QuestState } from '@/store/game'

export const pillarCount = (q: QuestState) => PUZZLES.filter((p) => (q.pillars[p] ?? 0) > 0).length
export const sealCount = (q: QuestState) => TREASURY.filter((p) => (q.pillars[p] ?? 0) > 0).length

/* ------------------------------ Pruebas ------------------------------ */
export interface PuzzleMeta {
  title: string
  icon: string
  where: string
  lesson: string
  codex: string[]
  topic: string
}

export const PUZZLE_META: Record<PuzzleId | 'boss', PuzzleMeta> = {
  inn: { title: 'La Posada Saturada', icon: '🏨', where: 'Ciudad Monolito', topic: 'load-balancing', codex: ['lb', 'health'],
    lesson: 'Un solo servidor no aguanta a todos: se escala **horizontalmente** con varios y un [[load-balancer|balanceador]] los reparte. "Menos ocupada" (least connections) gana cuando las estancias duran distinto, y sin [[health-check|health checks]] el balanceador manda tráfico a un servidor caído.' },
  library: { title: 'La Biblioteca del Olvido', icon: '📚', where: 'Biblioteca de la Memoria', topic: 'caching', codex: ['cache', 'belady'],
    lesson: 'Una caché pequeña sirve mucho si eliges bien qué expulsar. Con el futuro visible, lo óptimo es expulsar lo que más tardará en volver a pedirse (**Bélády**). Sin conocer el futuro, [[lru|LRU/LFU]] lo aproximan: LFU resiste los "escaneos" de datos que se piden una sola vez.' },
  ring: { title: 'El Anillo de los Custodios', icon: '💍', where: 'Bosque del Anillo', topic: 'consistent-hashing', codex: ['ring', 'vnodes'],
    lesson: 'Con [[consistent-hashing|consistent hashing]] cada clave va al primer nodo en sentido horario: al agregar un nodo solo se mueven las claves de un tramo. Con [[vnode|nodos virtuales]] cada nodo ocupa varias posiciones, la carga queda pareja y, si uno cae, su carga se reparte entre varios.' },
  harbor: { title: 'El Puerto de los Mensajes', icon: '⚓', where: 'Puerto de los Mensajes', topic: 'messaging', codex: ['partition', 'consumer'],
    lesson: 'El orden solo se garantiza dentro de una partición: los mensajes de una misma **clave** deben ir siempre al mismo carril. Y en un [[consumer-group|consumer group]] el paralelismo máximo es el número de particiones: más trabajadores que carriles no ayuda.' },
  bridge: { title: 'El Puente Partido', icon: '🌉', where: 'Valle Partido', topic: 'replication-cap', codex: ['cap', 'quorum'],
    lesson: 'Durante una [[network-partition|partición de red]] eliges por operación: lo que mueve dinero o inventario escaso necesita consistencia (solo la mayoría opera); lo demás puede seguir disponible con datos algo viejos. Con [[quorum|quórum]], si R + W > N toda lectura ve la última escritura.' },
  boss: { title: 'La Horda del Viernes Negro', icon: '🐉', where: 'Ciudadela del Pico', topic: 'reliability', codex: ['cdn', 'ratelimit', 'breaker'],
    lesson: 'Ningún patrón solo salva un sistema: caché para lecturas, CDN para estáticos, colas para escrituras, [[rate-limit|rate limiting]] contra abusos y [[circuit-breaker|circuit breakers]] para que una dependencia caída no tumbe todo. Así se sobrevive a un pico.' },
  vault: { title: 'La Bóveda Idempotente', icon: '🏦', where: 'Distrito del Tesoro', topic: 'payments-consistency', codex: ['idem-key', 'unknown-state'],
    lesson: 'Una [[idempotency|idempotency key]] con hash del payload evita cobrar dos veces: clave nueva → cobrar; misma clave y mismo hash → respuesta guardada (o 409 si sigue en curso); otro hash → 422. Y un timeout no es un "no": el pago queda PENDIENTE hasta consultar o conciliar.' },
  forge: { title: 'La Forja de Hilos', icon: '⛓️', where: 'Distrito del Tesoro', topic: 'concurrency', codex: ['pool-sizing', 'bounded-queue'],
    lesson: 'Un [[thread-pool|ThreadPoolExecutor]] crea hilos hasta core, luego encola y solo con la cola llena crece hasta max. Para I/O: hilos ≈ núcleos × (1 + espera/cálculo); para CPU: ≈ núcleos. Una cola sin límite convierte un pico en OutOfMemoryError.' },
  tower: { title: 'La Torre del Vigía', icon: '🗼', where: 'Distrito del Tesoro', topic: 'troubleshooting', codex: ['hot-thread', 'heap-leak', 'pool-starvation', 'deadlock'],
    lesson: 'CPU 100%: top → top -H → printf %x → jstack. Fuga: jstat (Old lleno tras Full GC) → histograma → heap dump → MAT. CPU baja con timeouts: los hilos esperan algo (pool, lock, consulta lenta → EXPLAIN). Captura evidencia antes de reiniciar.' },
  caravan: { title: 'La Ruta de las Caravanas', icon: '🐪', where: 'Distrito del Tesoro', topic: 'distributed-tx', codex: ['saga-pivot', 'tcc'],
    lesson: 'Una [[saga|saga]] compensa en orden inverso solo lo que se hizo, y tras el pivote se recupera hacia adelante. TCC reserva en Try y confirma o libera después: Confirm y Cancel idempotentes, cancelación vacía y anti-suspensión.' },
  aviary: { title: 'La Pajarera del Canario', icon: '🐤', where: 'Distrito del Tesoro', topic: 'deployments', codex: ['canary', 'auto-rollback'],
    lesson: 'Un despliegue canary sube el tráfico por pasos y compara la versión nueva con la estable. Umbrales y tiempo de observación bien elegidos permiten un rollback automático antes de afectar a todos, sin falsas alarmas.' },
  council: { title: 'El Consejo de los Sabios', icon: '👑', where: 'Distrito del Tesoro', topic: 'leadership', codex: ['star', 'blameless'],
    lesson: 'Ante el panel ejecutivo: respuestas STAR breves con resultados medibles, honestidad intelectual, decisiones con costo-beneficio, deuda técnica con capacidad reservada y post-mortems sin culpables.' },
}

/* ------------------------------ Códice ------------------------------ */
export interface CodexEntry {
  title: string
  icon: string
  text: string
  topic: string
}

export const CODEX: Record<string, CodexEntry> = {
  monolith: { title: 'El Gran Cristal (el monolito)', icon: '💎', topic: 'scalability', text: 'Todo el reino dependía de un único servidor: un [[spof|punto único de fallo]]. Escalar **verticalmente** (un cristal más grande) tiene un límite; escalar **horizontalmente** (muchos pilares) no.' },
  lb: { title: 'Balanceo de carga', icon: '⚖️', topic: 'load-balancing', text: 'El guardia de la posada es un [[load-balancer|load balancer]]. Round robin reparte por turnos; "menos ocupada" (least connections) mira la carga real y gana cuando cada petición tarda distinto.' },
  health: { title: 'Health checks', icon: '🩺', topic: 'load-balancing', text: 'El vigía detecta posadas en llamas y las saca de la rotación. Sin [[health-check|health checks]], "menos ocupada" es peor que nada: un servidor caído parece vacío y recibe todo el tráfico.' },
  cache: { title: 'Caché y expulsión', icon: '⚡', topic: 'caching', text: 'El escritorio de Lía es una caché: rápido pero pequeño. Cuando se llena hay que expulsar algo. [[lru|LRU]] expulsa lo usado hace más tiempo; LFU, lo menos usado; FIFO, lo más antiguo.' },
  belady: { title: 'El algoritmo de Bélády', icon: '🔮', topic: 'caching', text: 'Si conocieras el futuro, lo óptimo sería expulsar lo que más tardará en volver a pedirse. Nadie conoce el futuro, pero Bélády es la vara con la que se miden las demás políticas.' },
  ring: { title: 'Consistent hashing', icon: '💍', topic: 'consistent-hashing', text: 'Cada orbe pertenece al primer custodio en sentido horario. Al llegar un custodio nuevo solo cambian de dueño los orbes de su tramo, no todos (como pasaría con hash % N).' },
  vnodes: { title: 'Nodos virtuales', icon: '✨', topic: 'consistent-hashing', text: 'Cada custodio pone varias marcas en el anillo. Así la carga queda pareja y, si uno desaparece, sus orbes se reparten entre varios en lugar de aplastar a un solo vecino.' },
  partition: { title: 'Particiones y orden', icon: '🛳️', topic: 'messaging', text: 'Cada carril del puerto es una partición de [[kafka|Kafka]]. La clave del mensaje (el mercader) decide el carril: así todos sus mensajes se procesan en orden.' },
  consumer: { title: 'Consumer groups', icon: '👷', topic: 'messaging', text: 'Cada carril lo atiende un solo estibador del equipo. Con más estibadores que carriles, sobran: el paralelismo máximo es el número de particiones. El [[consumer-lag|lag]] es el agua que sube en el muelle.' },
  cap: { title: 'Teorema CAP', icon: '🌉', topic: 'replication-cap', text: 'Con el puente roto (partición), el Sur puede responder con datos viejos (disponibilidad) o negarse hasta tener la mayoría (consistencia). La respuesta correcta depende de la operación.' },
  quorum: { title: 'Quórum', icon: '🔐', topic: 'replication-cap', text: 'Con N escribas, escribir en W y leer de R garantiza ver lo último si R + W > N. Y si R y W son menores que N, el sistema aguanta que alguno enferme.' },
  cdn: { title: 'CDN', icon: '🌍', topic: 'networking', text: 'Las torres CDN sirven imágenes y archivos lejos del Núcleo, cerca de quien los pide. El Núcleo ni se entera.' },
  ratelimit: { title: 'Rate limiting', icon: '🚦', topic: 'rate-limiting', text: 'El semáforo deja pasar como mucho una cantidad de peticiones por segundo por cliente. Los enjambres de bots se estrellan contra él.' },
  breaker: { title: 'Circuit breaker', icon: '🛡️', topic: 'reliability', text: 'Cuando el servicio de Pagos cayó, el escudo dejó de llamarlo y respondió con un plan B. Sin él, cada petición esperaba un timeout y los hilos bloqueados hundían el Núcleo: un [[cascading-failure|fallo en cascada]].' },
  latency: { title: 'Pergamino: las latencias', icon: '⏱️', topic: 'scalability', text: 'Leer de memoria tarda nanosegundos; cruzar el océano, 150 milisegundos. Por eso guardamos cerca lo que se usa mucho. Mide en [[percentile|percentiles]], no en promedios.' },
  estimation: { title: 'Pergamino: estimar', icon: '🧮', topic: 'estimation', text: 'Un día tiene ~10⁵ segundos. Un millón de peticiones al día son ~12 por segundo. Estimar en órdenes de magnitud decide si algo cabe en una máquina.' },
  stateless: { title: 'Pergamino: sin estado', icon: '🎒', topic: 'scalability', text: 'Un servidor [[stateless|stateless]] no recuerda nada entre peticiones: la sesión vive fuera. Así cualquier instancia atiende a cualquiera y escalar es agregar instancias.' },
  idempotency: { title: 'Pergamino: idempotencia', icon: '🔁', topic: 'api-design', text: 'Pulsar el botón del ascensor cinco veces no llama cinco ascensores. Una operación [[idempotency|idempotente]] puede reintentarse sin cobrar dos veces.' },
  sharding: { title: 'Pergamino: sharding', icon: '🧩', topic: 'sharding', text: 'Cuando los datos no caben en una máquina, se parten en [[sharding|shards]]. La [[partition-key|clave de partición]] decide dónde vive cada dato: elígela por cómo se consulta.' },
  observability: { title: 'Pergamino: observabilidad', icon: '🔭', topic: 'observability', text: 'Métricas para saber que algo va mal, [[trace-span|trazas]] para saber dónde y logs para saber qué. Sin ellas, depurar un sistema distribuido es adivinar.' },
  search: { title: 'Pergamino: búsqueda', icon: '🔍', topic: 'search', text: 'Un [[inverted-index|índice invertido]] guarda, para cada palabra, en qué documentos aparece. Por eso buscar entre millones de textos tarda milisegundos.' },
  saga: { title: 'Pergamino: sagas', icon: '🧬', topic: 'microservices', text: 'Sin una transacción global, una [[saga|saga]] encadena pasos locales y, si uno falla, ejecuta compensaciones: reembolsar, liberar stock, cancelar.' },
  // Distrito del Tesoro
  'idem-key': { title: 'Idempotency key + hash', icon: '🔑', topic: 'payments-consistency', text: 'La clave identifica la operación; el hash del cuerpo detecta que alguien la reutilizó para otra cosa. Se guarda con UNIQUE en la misma transacción que el cobro.' },
  'unknown-state': { title: 'El estado DESCONOCIDO', icon: '❓', topic: 'payments-consistency', text: 'Tras un timeout, el pago queda PENDIENTE: se consulta al adquirente con la misma referencia y la conciliación diaria resuelve lo que quede. Nunca "fallido" a ciegas.' },
  'pool-sizing': { title: 'Dimensionar un pool', icon: '🧮', topic: 'concurrency', text: 'I/O: hilos ≈ núcleos × (1 + espera/cálculo), o [[littles-law|Ley de Little]]: tasa × latencia. CPU: hilos ≈ núcleos. Más hilos de CPU solo agregan cambios de contexto.' },
  'bounded-queue': { title: 'Cola acotada', icon: '📦', topic: 'concurrency', text: 'Executors.newFixedThreadPool usa una cola sin límite: un pico la llena hasta el OutOfMemoryError. Usa ThreadPoolExecutor con cola acotada y una política de rechazo explícita.' },
  'hot-thread': { title: 'El hilo caliente', icon: '🔥', topic: 'troubleshooting', text: 'top -H -p PID muestra el hilo que quema CPU; printf "%x" convierte su id; jstack muestra qué ejecuta (nid=0x…). Toma 2–3 dumps para confirmar.' },
  'heap-leak': { title: 'Fuga de memoria', icon: '💧', topic: 'troubleshooting', text: 'Si Old sigue lleno tras cada Full GC hay una fuga. jcmd GC.class_histogram dice QUÉ crece; el heap dump en Eclipse MAT dice QUIÉN lo retiene (camino a las GC roots).' },
  'pool-starvation': { title: 'Pool agotado', icon: '🐢', topic: 'sql-tuning', text: 'CPU baja y timeouts: los hilos esperan conexiones. La causa suele ser una consulta lenta; EXPLAIN ANALYZE revela el Seq Scan y un índice compuesto lo arregla.' },
  deadlock: { title: 'Deadlock', icon: '🔒', topic: 'concurrency', text: 'Dos hilos se esperan mutuamente. jstack lo detecta ("Found one Java-level deadlock"). Se evita adquiriendo los candados siempre en el mismo orden.' },
  'saga-pivot': { title: 'El pivote de la saga', icon: '🎯', topic: 'distributed-tx', text: 'Antes del pivote se compensa hacia atrás; después, los pasos deben ser reintentables y se avanza hacia adelante.' },
  tcc: { title: 'Try-Confirm-Cancel', icon: '🧊', topic: 'distributed-tx', text: 'Try reserva, Confirm consume, Cancel libera. Los participantes registran cada transacción para soportar duplicados, cancelaciones vacías y Try tardíos.' },
  canary: { title: 'Despliegue canary', icon: '🐤', topic: 'deployments', text: '1% → 5% → 25% → 50% → 100%, comparando la versión nueva contra la estable en cada paso. Si empeora, rollback.' },
  'auto-rollback': { title: 'Rollback automático', icon: '🤖', topic: 'deployments', text: 'Umbrales sobre error y p99 relativos a la estable, con tiempo de observación suficiente para separar señal de ruido.' },
  star: { title: 'Método STAR', icon: '⭐', topic: 'leadership', text: 'Situación, Tarea, Acción y Resultado medible. Respuestas de 1–2 minutos, en primera persona y con números.' },
  blameless: { title: 'Post-mortem sin culpables', icon: '🕊️', topic: 'leadership', text: 'Línea de tiempo, causa raíz (5 porqués), acciones con dueño y fecha, y seguimiento. Se corrigen sistemas, no personas.' },
  kiss: { title: 'Pergamino: KISS', icon: '🪶', topic: 'payments-consistency', text: 'Si una restricción UNIQUE o un índice bien puesto resuelve el problema, no agregues colas, locks distribuidos ni hilos virtuales. Cada pieza debe justificarse con números.' },
  english: { title: 'Pergamino: inglés técnico', icon: '🌎', topic: 'leadership', text: '"The trade-off here is…", "I would start with the simplest option that meets the SLO", "I am not sure, but here is how I would find out", "The root cause was…, and the safeguard we added is…".' },
}

/* ------------------------------ Diálogos ------------------------------ */
export const NAMES: Record<string, string> = {
  ada: 'Maestra Ada',
  tomas: 'Tomás, el posadero',
  lia: 'Lía, la bibliotecaria',
  rin: 'Custodia Rin',
  offset: 'Capitana Offset',
  paxi: 'Alcaldesa Paxi',
  'guard-citadel': 'Guardia de la Ciudadela',
  'guard-south': 'Guardia',
  sage: 'Viejo Sabio',
  idem: 'Tesorera Idem',
  hilda: 'Hilda, la herrera',
  jota: 'Vigía Jota',
  tece: 'Tecé, la caravanera',
  canaria: 'Canaria, la cuidadora',
  estrella: 'Directora Estrella',
  herald: 'Heraldo del Tesoro',
  hero: 'Tú',
}

const L = (who: string, text: string, portrait = who): DialogLine => ({ who: NAMES[who] ?? who, portrait, text })
const V = (look: string, name: string, text: string): DialogLine => ({ who: name, portrait: look, text })

export const INTRO: DialogLine[] = [
  L('ada', '¡Por fin despiertas, aprendiz! Mira el **Gran Cristal**: durante siglos atendió él solo cada petición del reino de Nimbus.'),
  L('ada', 'Pero el reino creció. Llegó la **Gran Afluencia** y el cristal no da abasto. Las peticiones se acumulan y la **Niebla de Latencia** cubre los caminos.'),
  L('ada', 'Un solo cristal es un [[spof|punto único de fallo]]. Necesitamos **cinco pilares**, cinco ideas de arquitectura, para repartir la carga del reino.'),
  L('ada', 'Cada prueba que superes encenderá un pilar y disipará parte de la niebla. Empieza por la **Posada de Tomás**, aquí al este de la plaza. ¡Suerte, Arquitecto!'),
]

const guardianIntro: Record<PuzzleId | 'boss', DialogLine[]> = {
  inn: [
    L('tomas', '¡Ayuda! Desde la Gran Afluencia llegan viajeros sin parar y mi guardia no sabe a qué posada mandarlos.'),
    L('tomas', 'Si una posada se llena, los viajeros se van enojados. Tú decides a dónde va cada uno: ¡reparte bien la carga!'),
  ],
  library: [
    L('lia', 'Mi escritorio solo tiene sitio para **tres libros**. Todo lo demás está en el archivo del sótano, a mil escalones.'),
    L('lia', 'Si el libro que piden está en el escritorio, ¡acierto inmediato! Si no, bajo al sótano… y algo tiene que salir del escritorio.'),
  ],
  ring: [
    L('rin', 'Los orbes del reino descansan en un anillo. Cada orbe lo protege el **primer custodio en el sentido de las agujas del reloj**.'),
    L('rin', 'Coloca a los custodios para que nadie cargue más de lo justo. Y cuando lleguen nuevos… que se mueva lo mínimo.'),
  ],
  harbor: [
    L('offset', '¡Ahoy! Los mercaderes mandan cajas numeradas: 1, 2, 3… y su cliente debe recibirlas **en orden**.'),
    L('offset', 'Tengo varios carriles y un estibador en cada uno. Si repartes mal, la caja 3 llega antes que la 2. ¡Y luego viene la tormenta!'),
  ],
  bridge: [
    L('paxi', 'El puente cayó y el pueblo quedó partido: 2 escribas del libro de cuentas en el Norte, 1 en el Sur. No pueden hablar entre ellos.'),
    L('paxi', 'La gente sigue pidiendo cosas. ¿Atendemos con lo que sabemos o esperamos al puente? Y luego, la Cerradura del Quórum…'),
  ],
  boss: [
    L('guard-citadel', 'Los cinco pilares brillan… Entonces eres digno. Tras esta puerta se acerca **la Horda del Viernes Negro**.'),
    L('guard-citadel', 'Lecturas, imágenes, escrituras, bots… y en lo peor, el servicio de Pagos caerá. Usa todo lo que aprendiste.'),
  ],
  vault: [
    L('idem', 'Bienvenido a la Bóveda. Aquí cada moneda cuenta: **ningún cliente puede pagar dos veces** y ningún pago puede perderse.'),
    L('idem', 'Los clientes reintentan, las apps tienen bugs y la red se corta en el último milisegundo. ¿Sabrás qué hacer con cada petición?'),
  ],
  forge: [
    L('hilda', 'En mi forja cada yunque es un hilo. Demasiado pocos y la fila de trabajos no avanza; demasiados y se estorban.'),
    L('hilda', 'Configura el **ThreadPoolExecutor**: hilos base, máximo, cola y política de rechazo. ¡Y ojo con la cola sin fondo!'),
  ],
  tower: [
    L('jota', 'Son las 3 de la mañana y suena la alarma. Desde esta torre veo los servidores del reino… con comandos de Linux y de la JVM.'),
    L('jota', 'Nada de "reinicia y ya": encuentra la **causa raíz** con top, jstack, jstat, jcmd y EXPLAIN. Cuatro incidentes te esperan.'),
  ],
  caravan: [
    L('tece', 'Mis caravanas llevan pagos de pueblo en pueblo: billetera, antifraude, adquirente y comercio. Cada uno con su propio libro.'),
    L('tece', 'Si una caravana cae a mitad de camino, hay que **compensar** lo hecho… o seguir adelante. Y luego, el protocolo TCC.'),
  ],
  aviary: [
    L('canaria', 'Antes de soltar una versión nueva a todo el reino, suelto un **canario**: un 1% del tráfico.'),
    L('canaria', 'Si el canario enferma, rollback. Si está sano, más tráfico. Primero tú decides; luego lo automatizamos.'),
  ],
  council: [
    L('estrella', 'El Consejo no pregunta por librerías: pregunta **cómo decides**, cómo aprendes de tus errores y cómo hablas de negocio.'),
    L('estrella', 'Estructura tus historias con STAR, sé breve y honesto… y prepárate: parte de la sesión es en inglés.'),
  ],
}

const guardianDone: Record<PuzzleId | 'boss', DialogLine[]> = {
  inn: [L('tomas', '¡Las posadas funcionan como un reloj! Ahora sé que muchas posadas y un buen guardia valen más que una gigante.')],
  library: [L('lia', 'Desde que sé qué guardar en el escritorio apenas bajo al sótano. ¡Mis rodillas te lo agradecen!')],
  ring: [L('rin', 'El anillo está en equilibrio. Recuerda: muchas marcas por custodio, bien intercaladas.')],
  harbor: [L('offset', '¡Ni una caja fuera de orden! Clave fija, carril fijo. Y tantos estibadores como carriles.')],
  bridge: [L('paxi', 'Gracias a ti el pueblo sabe cuándo esperar y cuándo seguir. Y la cerradura del quórum quedó a prueba de enfermedades.')],
  boss: [L('guard-citadel', 'La Horda fue derrotada. Nimbus vuelve a respirar. Leyenda, eso eres.')],
  vault: [L('idem', 'Ni un cobro duplicado, ni un pago perdido. Así se cuida el dinero ajeno: idempotencia, estados claros y conciliación.')],
  forge: [L('hilda', '¡La forja canta! Hilos según el tipo de trabajo, cola acotada y un plan para cuando ni la cola alcanza.')],
  tower: [L('jota', 'Comandos concretos, evidencia antes de reiniciar y causa raíz. Así responde alguien que ha estado de guardia.')],
  caravan: [L('tece', 'Compensar hacia atrás, reintentar después del pivote y TCC sin fondos colgados. Mis caravanas llegan siempre.')],
  aviary: [L('canaria', 'Mis canarios cantan tranquilos: rollback automático y sin falsas alarmas.')],
  council: [L('estrella', 'El Consejo está convencido. Claro, breve, honesto y con números: así se habla con la dirección.')],
}

export function guardianLines(puzzle: PuzzleId | 'boss', solved: boolean): DialogLine[] {
  return solved ? guardianDone[puzzle] : guardianIntro[puzzle]
}

export function npcLines(id: string, q: QuestState): DialogLine[] {
  const p = pillarCount(q)
  switch (id) {
    case 'ada':
      if (sealCount(q) < 6 && p > 0 && q.bossStars === 0 && Math.random() < 0.35) return [L('ada', '¿Te preparas para una entrevista? El **Distrito del Tesoro**, al noroeste de la plaza, entrena idempotencia, hilos, incidentes, sagas, despliegues y liderazgo.')]
      if (q.bossStars > 0) return [L('ada', '¡Lo lograste! El cristal ya no está solo: cinco pilares y un reino bien diseñado. Puedes repetir cualquier prueba para mejorar tus estrellas.')]
      if (p === 5) return [L('ada', 'Los cinco pilares brillan. Solo queda la **Ciudadela del Pico**, al noreste, pasando la Biblioteca. Allí espera la Horda.')]
      if (p === 0) return [L('ada', 'La Posada de Tomás está al este de la plaza. Allí empieza todo: aprende a repartir la carga.')]
      return [L('ada', `Llevas ${p} de 5 pilares. ${p === 1 ? 'La niebla del norte y del oeste se disipó: la Biblioteca y el Puerto te esperan.' : p === 2 ? 'Ya puedes cruzar al este, al Bosque del Anillo.' : p === 3 ? 'El paso al Valle Partido, al sur, está abierto.' : 'Te falta muy poco.'}`)]
    case 'vil-latency':
      return [V('vil1', 'Vecina', 'Le pedí al cristal mi correspondencia el lunes… ¡y me la dio el jueves! Dicen que lo llaman [[latency|latencia]].')]
    case 'vil-scale':
      return [V('vil3', 'Herrero', 'El alcalde quería un cristal el doble de grande. Pero uno más grande también se cae, ¿no? Yo pondría varios pequeños.')]
    case 'guard-south':
      return [V('guard', 'Guardia', p >= 3 ? 'El paso al Valle Partido está libre. Ten cuidado con el río.' : 'La niebla del sur es espesa. Vuelve cuando brillen tres pilares.')]
    case 'vil-library':
      return [V('vil4', 'Lector', 'Siempre pido los mismos dos libros. ¡Ojalá Lía los tuviera siempre a mano!')]
    case 'vil-harbor':
      return [V('vil2', 'Marinero', 'Una vez pusimos 10 estibadores en 4 carriles. Seis se pasaron el día mirando gaviotas.')]
    case 'vil-valley':
      return [V('vil1', 'Aldeana', 'En el Sur vendieron la misma vaca a dos personas mientras el puente estaba roto. Desde entonces hay reuniones cada noche.')]
    case 'sage':
      return [V('sage', 'Viejo Sabio', p >= 5 ? 'Tu códice está lleno de ideas. Recuerda: ningún patrón sirve para todo. Elige por los números y los riesgos.' : 'Busca pergaminos por el reino: cada uno guarda una idea que te hará más sabio.')]
    case 'guard-citadel':
      return [V('guard', NAMES['guard-citadel'], 'Nadie entra sin los cinco pilares encendidos.')]
    case 'herald': {
      const s = sealCount(q)
      return [V('vil2', NAMES.herald, s === 6 ? '¡Rompiste los seis sellos! Estás listo para la entrevista. Puedes repetir las pruebas cuando quieras.' : `Por este sendero, al noroeste, está el **Distrito del Tesoro**. Seis pruebas para entrenar una entrevista de backend Java en pagos. Llevas ${s} de 6 sellos.`)]
    }
    case 'vil-treasury':
      return [V('vil4', 'Contable', 'Aquí aprendimos que el dinero nunca se guarda en FLOAT. Centavos enteros y un ledger que siempre cuadra.')]
    default:
      return [V('vil1', 'Aldeano', '¡Buen día, Arquitecto!')]
  }
}

/* ------------------------------ Objetivo ------------------------------ */
export function objective(q: QuestState): string {
  const p = pillarCount(q)
  if (!q.started) return 'Habla con la Maestra Ada'
  if (q.bossStars > 0) return sealCount(q) < 6 ? `¡Nimbus está a salvo! Rompe los sellos del Tesoro (${sealCount(q)}/6, noroeste)` : '¡Nimbus está a salvo! Mejora tus estrellas o busca pergaminos'
  if (p === 0) return 'Ve a la Posada de Tomás (este de la plaza)'
  if (p === 5) return 'Entra en la Ciudadela del Pico (noreste)'
  const missing = PUZZLES.filter((x) => !(q.pillars[x] ?? 0))
    .filter((x) => (x === 'library' || x === 'harbor' ? p >= 1 : x === 'ring' ? p >= 2 : x === 'bridge' ? p >= 3 : true))
    .map((x) => PUZZLE_META[x].where)
  return missing.length ? `Pilares ${p}/5 · Visita: ${missing.join(' o ')}` : `Pilares ${p}/5 · Busca un nuevo camino`
}
