import type { Block } from './types'

export interface Article {
  /** Explicación de una frase con analogía (encabezado del artículo). */
  lead: string
  minutes: number
  blocks: Block[]
  code?: { title: string; java: string; python: string }
  links: { title: string; url: string; lang: 'es' | 'en'; kind: 'docs' | 'paper' | 'blog' | 'wiki' | 'libro' | 'video' }[]
  related: string[] // ids del glosario
}

export const ARTICLES: Record<string, Article> = {
  mutex: {
    lead: 'Un mutex es la llave del baño de una oficina: solo quien la tiene puede entrar; los demás hacen fila hasta que se devuelve.',
    minutes: 6,
    blocks: [
      { type: 'p', text: 'Cuando varios hilos comparten datos (un contador, un mapa, el saldo de una cuenta), pueden pisarse. **Mutex** viene de *mutual exclusion* (exclusión mutua): un objeto que solo un hilo puede "tener" a la vez. El código protegido por el mutex se llama **sección crítica**.' },
      { type: 'h', text: 'El problema que resuelve' },
      { type: 'p', text: 'La instrucción `saldo = saldo + 100` parece una sola operación, pero el CPU hace tres: leer, sumar, escribir. Si dos hilos la ejecutan a la vez, ambos pueden leer 500, ambos escriben 600, y se pierden 100. Eso es una [[race-condition|condición de carrera]].' },
      { type: 'table', head: ['Paso', 'Hilo A', 'Hilo B', 'saldo'], rows: [['1', 'lee 500', '', '500'], ['2', '', 'lee 500', '500'], ['3', 'escribe 600', '', '600'], ['4', '', 'escribe 600', '**600** (debía ser 700)']] },
      { type: 'h', text: '¿Por qué cuesta ~17 ns?' },
      { type: 'p', text: 'Tomar y soltar un mutex sin competencia usa instrucciones [[atomic|atómicas]] del CPU (compare-and-swap) que obligan a sincronizar las [[cpu-cache|cachés]] de los núcleos. Es barato comparado con la red, pero caro comparado con una suma (≈0,3 ns). Si hay **contención** (muchos hilos peleando por el mismo candado), los hilos se duermen y despiertan, y el costo sube a microsegundos.' },
      { type: 'callout', tone: 'warn', title: 'Peligros', text: '**Deadlock**: el hilo A tiene el candado 1 y espera el 2; el hilo B tiene el 2 y espera el 1. Ninguno avanza. Se evita tomando siempre los candados en el mismo orden. **Contención**: un único mutex global convierte tu servidor multinúcleo en uno de un solo núcleo.' },
      { type: 'h', text: 'Y en System Design...' },
      { type: 'list', items: [
        'Un mutex solo funciona **dentro de un proceso**. Con 20 instancias de tu servicio necesitas un **lock distribuido** (Redis `SET key NX PX`, etcd, ZooKeeper) o, mejor, evitar el lock con operaciones atómicas de la base de datos (`UPDATE ... WHERE version = ?`).',
        'Alternativas sin lock: estructuras concurrentes (`ConcurrentHashMap`), contadores atómicos (`AtomicLong`, `INCR` de Redis) o asignar cada clave a un único hilo/partición (como hace Kafka).',
        'Los locks distribuidos necesitan expiración (por si el dueño muere) y **fencing tokens** para que un dueño "zombi" no escriba después de perder el lock.',
      ] },
    ],
    code: {
      title: 'Contador seguro con lock',
      java: `import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.atomic.AtomicLong;

class Cuenta {
    private final ReentrantLock lock = new ReentrantLock();
    private long saldo = 0;

    void depositar(long monto) {
        lock.lock();          // toma la "llave"
        try {
            saldo += monto;   // sección crítica
        } finally {
            lock.unlock();    // SIEMPRE devolverla, incluso si hay excepción
        }
    }
}

// Para un simple contador, mejor una operación atómica sin lock:
class Visitas {
    private final AtomicLong total = new AtomicLong();
    void sumar() { total.incrementAndGet(); }
}`,
      python: `import threading

class Cuenta:
    def __init__(self):
        self._lock = threading.Lock()
        self.saldo = 0

    def depositar(self, monto: int) -> None:
        with self._lock:          # toma y suelta la "llave" automáticamente
            self.saldo += monto   # sección crítica

# Ojo: el GIL de CPython NO hace que "saldo += monto" sea atómico.
# Entre leer y escribir otro hilo puede ejecutarse: el lock sigue siendo necesario.`,
    },
    links: [
      { title: 'Lock (computer science) — Wikipedia', url: 'https://en.wikipedia.org/wiki/Lock_(computer_science)', lang: 'en', kind: 'wiki' },
      { title: 'Mutual exclusion — Wikipedia', url: 'https://en.wikipedia.org/wiki/Mutual_exclusion', lang: 'en', kind: 'wiki' },
      { title: 'Java Tutorials: Synchronization', url: 'https://docs.oracle.com/javase/tutorial/essential/concurrency/sync.html', lang: 'en', kind: 'docs' },
      { title: 'Python docs: threading — Lock objects', url: 'https://docs.python.org/3/library/threading.html#lock-objects', lang: 'en', kind: 'docs' },
      { title: 'Martin Kleppmann: How to do distributed locking', url: 'https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html', lang: 'en', kind: 'blog' },
    ],
    related: ['race-condition', 'atomic', 'concurrency', 'cpu-cache'],
  },

  'cpu-cache': {
    lead: 'La jerarquía de memoria es como tu escritorio: lo que usas ahora está en la mano (L1), lo de hoy en el escritorio (L2/L3), lo del mes en el archivero (RAM) y lo del año en el sótano (disco).',
    minutes: 6,
    blocks: [
      { type: 'p', text: 'Un CPU moderno ejecuta miles de millones de operaciones por segundo, pero traer un dato de la [[ram|RAM]] tarda ~100 ns: en ese tiempo podría haber hecho cientos de operaciones. Para no quedarse esperando, guarda copias de los datos recientes en cachés pequeñas y rapidísimas dentro del chip.' },
      { type: 'table', head: ['Nivel', 'Tamaño típico', 'Latencia', 'Analogía (1 ns = 1 s)'], rows: [
        ['Registros', 'bytes', '< 1 ns', 'lo que tienes en la mano'],
        ['L1', '32–64 KB por núcleo', '~1 ns', '1 segundo'],
        ['L2', '256 KB–2 MB por núcleo', '~4 ns', '4 segundos'],
        ['L3', 'decenas de MB compartidos', '~10–40 ns', 'medio minuto'],
        ['RAM', 'GB', '~100 ns', 'casi 2 minutos'],
        ['SSD (lectura aleatoria)', 'TB', '~16 µs', '4,5 horas'],
        ['Red transatlántica', '—', '~150 ms', '4,8 años'],
      ] },
      { type: 'h', text: 'Localidad: por qué el orden importa' },
      { type: 'p', text: 'El CPU no trae un byte suelto: trae una **línea de caché** de 64 bytes. Recorrer un arreglo en orden aprovecha esa línea (localidad espacial); saltar por punteros dispersos (listas enlazadas, objetos por todo el heap) provoca un *cache miss* tras otro. Por eso un array de números suele ganarle a una lista enlazada aunque la teoría Big-O diga lo mismo.' },
      { type: 'callout', tone: 'tip', title: 'La misma idea, a otra escala', text: 'Todo System Design repite este patrón: guardar lo usado recientemente en un nivel más rápido y pequeño. La caché de CPU, la caché de la base de datos (buffer pool), [[redis|Redis]] y la [[cdn|CDN]] son la misma idea a escalas de nanosegundos, microsegundos, milisegundos y kilómetros.' },
      { type: 'h', text: 'Branch prediction' },
      { type: 'p', text: 'El CPU también "adivina" el resultado de los `if` para ir adelantando instrucciones. Si acierta (lo normal en datos ordenados o patrones repetitivos), gana tiempo; si falla (**branch mispredict**), descarta lo adelantado: ~3 ns. Es la explicación de la famosa pregunta de StackOverflow sobre por qué procesar un arreglo ordenado es más rápido.' },
    ],
    links: [
      { title: 'Latency numbers every programmer should know (gist)', url: 'https://gist.github.com/jboner/2841832', lang: 'en', kind: 'blog' },
      { title: 'Interactive latency numbers por año (Colin Scott)', url: 'https://colin-scott.github.io/personal_website/research/interactive_latency.html', lang: 'en', kind: 'blog' },
      { title: 'CPU cache — Wikipedia', url: 'https://en.wikipedia.org/wiki/CPU_cache', lang: 'en', kind: 'wiki' },
      { title: 'Ulrich Drepper: What Every Programmer Should Know About Memory', url: 'https://people.freebsd.org/~lstewart/articles/cpumemory.pdf', lang: 'en', kind: 'paper' },
      { title: 'StackOverflow: Why is processing a sorted array faster?', url: 'https://stackoverflow.com/questions/11227809', lang: 'en', kind: 'blog' },
    ],
    related: ['ram', 'branch-mispredict', 'ssd', 'cache-hit'],
  },

  percentile: {
    lead: 'Si 100 personas esperan un bus, el promedio de espera puede ser 5 minutos aunque 1 persona haya esperado una hora. El percentil 99 te cuenta la historia de esa persona.',
    minutes: 5,
    blocks: [
      { type: 'p', text: 'El percentil N es el valor por debajo del cual cae el N% de las mediciones. Si **p99 = 800 ms**, 99 de cada 100 peticiones tardan menos de 800 ms y 1 tarda más. **p50** es la mediana: la experiencia "típica".' },
      { type: 'h', text: 'Por qué el promedio engaña' },
      { type: 'p', text: 'Latencias: 10, 10, 10, 10, 10, 10, 10, 10, 10, 2.000 ms. El promedio es **209 ms** (no lo sintió nadie), la mediana **10 ms** y el p99 **2.000 ms**. Una sola petición lenta distorsiona el promedio pero no te dice cuántos usuarios sufren.' },
      { type: 'h', text: 'La cola se amplifica con el fan-out' },
      { type: 'p', text: 'Si cargar una página llama a 100 servicios en paralelo y cada uno tiene un p99 de 1 s, la probabilidad de que **al menos uno** sea lento es 1 − 0,99¹⁰⁰ ≈ **63%**. Lo raro en un servicio se vuelve lo normal en la página. Por eso Google publicó *The Tail at Scale* con técnicas como las **hedged requests** (mandar la petición a una segunda réplica si la primera tarda).' },
      { type: 'callout', tone: 'interview', text: 'Formula los requisitos con percentiles: "p99 < 200 ms para la lectura del feed". Y recuerda que no se pueden promediar percentiles entre servidores: hay que agregar los histogramas.' },
    ],
    code: {
      title: 'Calcular percentiles',
      java: `import java.util.Arrays;

static double percentile(double[] latencias, double p) {
    double[] s = latencias.clone();
    Arrays.sort(s);
    int idx = (int) Math.ceil(p / 100.0 * s.length) - 1;
    return s[Math.max(0, idx)];
}
// En producción: Micrometer + histogramas (Timer.builder(...).publishPercentiles(0.5, 0.99))`,
      python: `import statistics

lat = [10] * 9 + [2000]
print(statistics.mean(lat))                      # 209.0  -> engañoso
print(statistics.median(lat))                    # 10.0
print(statistics.quantiles(lat, n=100)[98])      # ~p99
# En producción: prometheus_client.Histogram y la función histogram_quantile()`,
    },
    links: [
      { title: 'Dean & Barroso: The Tail at Scale (CACM)', url: 'https://research.google/pubs/the-tail-at-scale/', lang: 'en', kind: 'paper' },
      { title: 'Percentil — Wikipedia (es)', url: 'https://es.wikipedia.org/wiki/Percentil', lang: 'es', kind: 'wiki' },
      { title: 'Google SRE Book: Service Level Objectives', url: 'https://sre.google/sre-book/service-level-objectives/', lang: 'en', kind: 'libro' },
      { title: 'Prometheus: Histograms and summaries', url: 'https://prometheus.io/docs/practices/histograms/', lang: 'en', kind: 'docs' },
    ],
    related: ['latency', 'throughput', 'sla', 'fan-out'],
  },

  'littles-law': {
    lead: 'En un restaurante entran 30 personas por hora y cada una se queda 2 horas: en promedio habrá 60 personas dentro. Necesitas al menos 60 sillas.',
    minutes: 4,
    blocks: [
      { type: 'p', text: '**L = λ × W**. L: elementos dentro del sistema (concurrencia). λ: tasa de llegada. W: tiempo que pasa cada uno dentro. Funciona para cualquier sistema estable, sin importar la distribución de llegadas.' },
      { type: 'h', text: 'Usos prácticos' },
      { type: 'list', items: [
        '**Thread pools**: 2.000 RPS × 50 ms = 100 peticiones en vuelo → necesitas ≥ 100 hilos (o I/O asíncrono).',
        '**Pool de conexiones a la DB**: 500 consultas/s × 20 ms = 10 conexiones ocupadas en promedio. Configurar 200 no ayuda: solo carga a la base de datos.',
        '**Colas**: si entran 1.000 mensajes/s y cada uno espera 30 s, hay 30.000 en la cola.',
        '**Efecto dominó**: si una dependencia pasa de 50 ms a 5 s, W se multiplica ×100 y la concurrencia también: tu pool de 200 hilos se agota. Por eso existen los [[timeout|timeouts]] y los [[circuit-breaker|circuit breakers]].',
      ] },
      { type: 'callout', tone: 'tip', text: 'Combínala con la teoría de colas: cerca del 100% de utilización, W crece de forma explosiva. Dimensiona para ~70% de uso en el pico.' },
    ],
    links: [
      { title: "Little's law — Wikipedia", url: 'https://en.wikipedia.org/wiki/Little%27s_law', lang: 'en', kind: 'wiki' },
      { title: 'Marc Brooker: Telling Stories About Little\'s Law', url: 'https://brooker.co.za/blog/2018/06/20/littles-law.html', lang: 'en', kind: 'blog' },
    ],
    related: ['thread-pool', 'latency', 'throughput', 'timeout'],
  },

  rtt: {
    lead: 'Un round trip es enviar una carta y esperar la respuesta: no importa lo rápido que escribas, el correo tarda lo que tarda. En redes, el "correo" es la velocidad de la luz.',
    minutes: 5,
    blocks: [
      { type: 'p', text: 'El **RTT** (round-trip time) es el tiempo de ida y vuelta de un paquete. Dentro de un [[datacenter|datacenter]] es ~0,5 ms; entre zonas de una región ~1–2 ms; de California a Europa ~150 ms. Ninguna optimización de código lo reduce: la luz en fibra viaja a ~200.000 km/s.' },
      { type: 'h', text: 'Cuántos round trips cuesta una petición nueva' },
      { type: 'table', head: ['Paso', 'Round trips'], rows: [
        ['Resolución [[dns|DNS]] (si no está en caché)', '1 o más'],
        ['Handshake [[tcp|TCP]]', '1'],
        ['Handshake [[tls|TLS 1.3]]', '1 (0 con resumption)'],
        ['Petición HTTP', '1'],
        ['**Total** con un servidor a 150 ms', '≈ 600 ms antes del primer byte'],
      ] },
      { type: 'p', text: 'HTTP/3 (QUIC) combina transporte y TLS en un solo handshake. Una [[cdn|CDN]] termina la conexión cerca del usuario: el handshake recorre 10 ms en vez de 150 ms.' },
      { type: 'callout', tone: 'interview', text: 'Cada llamada de red en serie suma un RTT. Un endpoint que hace 10 consultas secuenciales a una DB a 1 ms tarda ≥ 10 ms solo en red: agrúpalas (batch), hazlas en paralelo o cachea. Las conexiones persistentes (keep-alive, pools) evitan repetir handshakes.' },
    ],
    links: [
      { title: 'MDN: Round Trip Time (RTT)', url: 'https://developer.mozilla.org/en-US/docs/Glossary/Round_Trip_Time', lang: 'en', kind: 'docs' },
      { title: 'Cloudflare: What happens in a TLS handshake?', url: 'https://www.cloudflare.com/learning/ssl/what-happens-in-a-tls-handshake/', lang: 'en', kind: 'blog' },
      { title: 'Ilya Grigorik: High Performance Browser Networking (libro gratuito)', url: 'https://hpbn.co/', lang: 'en', kind: 'libro' },
    ],
    related: ['tcp', 'tls', 'cdn', 'latency'],
  },

  ssd: {
    lead: 'Un disco duro (HDD) es un tocadiscos: hay que mover la aguja hasta la canción. Un SSD es una memoria USB gigante: salta a cualquier lugar casi al instante.',
    minutes: 4,
    blocks: [
      { type: 'table', head: ['', 'HDD', 'SSD (NVMe)', 'RAM'], rows: [
        ['Lectura aleatoria 4 KB', '~2–10 ms (seek)', '~16–100 µs', '~100 ns'],
        ['Lectura secuencial', '~100–200 MB/s', '~2–7 GB/s', '> 10 GB/s'],
        ['IOPS aleatorias', '~100–200', 'cientos de miles', '—'],
        ['Costo por GB', 'el más bajo', 'medio', 'alto'],
        ['Persistente', 'sí', 'sí', 'no'],
      ] },
      { type: 'p', text: 'La gran diferencia está en el acceso **aleatorio**: un HDD hace ~100 búsquedas por segundo porque debe mover un brazo mecánico. Por eso las bases de datos clásicas se diseñaron para leer y escribir **secuencialmente** (logs, [[lsm|LSM-trees]], [[wal|WAL]]), y por eso un índice que evita leer toda la tabla importa tanto.' },
      { type: 'callout', tone: 'tip', title: 'En la nube', text: 'Los discos de bloque (EBS, Azure Managed Disks, Persistent Disk) se cobran por IOPS y throughput además de por GB, y van por red (~0,5–1 ms extra). Los discos locales NVMe son más rápidos pero se pierden si la instancia muere. Para archivos grandes usa [[object-storage|object storage]].' },
    ],
    links: [
      { title: 'Solid-state drive — Wikipedia', url: 'https://en.wikipedia.org/wiki/Solid-state_drive', lang: 'en', kind: 'wiki' },
      { title: 'Hard disk drive performance characteristics — Wikipedia', url: 'https://en.wikipedia.org/wiki/Hard_disk_drive_performance_characteristics', lang: 'en', kind: 'wiki' },
      { title: 'AWS: Amazon EBS volume types', url: 'https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html', lang: 'en', kind: 'docs' },
    ],
    related: ['hdd', 'ram', 'lsm', 'btree'],
  },

  idempotency: {
    lead: 'Pulsar el botón del ascensor cinco veces no llama cinco ascensores. Una operación idempotente puede repetirse sin efectos extra.',
    minutes: 6,
    blocks: [
      { type: 'p', text: 'En sistemas distribuidos los mensajes se pierden, se duplican y los clientes reintentan. Si el cliente envía "cobrar $50", el servidor cobra, pero la respuesta se pierde por la red, el cliente no sabe si se cobró y reintenta. Sin idempotencia, **cobras dos veces**.' },
      { type: 'h', text: 'Qué operaciones lo son' },
      { type: 'table', head: ['Operación', '¿Idempotente?', 'Por qué'], rows: [
        ['GET /users/42', 'Sí', 'Solo lee'],
        ['PUT /users/42 {nombre: "Ana"}', 'Sí', 'Deja el mismo estado final'],
        ['DELETE /users/42', 'Sí', 'Borrar dos veces = borrado'],
        ['POST /orders', '**No**', 'Cada llamada crea un pedido nuevo'],
        ['saldo = saldo + 50', '**No**', 'Cada repetición suma'],
        ['saldo = 550 WHERE version = 7', 'Sí', 'Solo aplica si la versión coincide'],
      ] },
      { type: 'h', text: 'Cómo hacer idempotente lo que no lo es' },
      { type: 'list', items: [
        '**Idempotency key**: el cliente genera un UUID por operación lógica y lo envía en un header. El servidor guarda (clave → respuesta) y ante una repetición devuelve la respuesta guardada.',
        '**Restricción UNIQUE**: `INSERT ... ON CONFLICT DO NOTHING` sobre un id de operación.',
        '**Deduplicación en consumidores**: guardar los ids de mensajes ya procesados (las colas entregan [[delivery|al menos una vez]]).',
        '**Versiones / compare-and-set**: actualizar solo si el estado es el esperado.',
      ] },
      { type: 'callout', tone: 'interview', text: '"Exactly-once" en la práctica es **at-least-once + idempotencia**. Si tu diseño tiene reintentos, colas o webhooks, di explícitamente cómo evitas duplicados.' },
    ],
    links: [
      { title: 'MDN: Idempotent', url: 'https://developer.mozilla.org/en-US/docs/Glossary/Idempotent', lang: 'en', kind: 'docs' },
      { title: 'Stripe: Designing robust and predictable APIs with idempotency', url: 'https://stripe.com/blog/idempotency', lang: 'en', kind: 'blog' },
      { title: 'Stripe API docs: Idempotent requests', url: 'https://docs.stripe.com/api/idempotent_requests', lang: 'en', kind: 'docs' },
      { title: 'AWS Builders\' Library: Making retries safe with idempotent APIs', url: 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/', lang: 'en', kind: 'blog' },
    ],
    related: ['delivery', 'retry', 'outbox', 'rest'],
  },

  acid: {
    lead: 'Una transferencia bancaria tiene dos pasos: restar de una cuenta y sumar a otra. ACID garantiza que nunca verás solo la mitad.',
    minutes: 7,
    blocks: [
      { type: 'list', items: [
        '**Atomicidad**: la transacción ocurre completa o no ocurre. Si falla a la mitad, se deshace (rollback).',
        '**Consistencia**: se respetan las reglas (constraints, claves foráneas, "saldo ≥ 0").',
        '**Aislamiento** (Isolation): transacciones concurrentes no ven los cambios a medio hacer de las otras.',
        '**Durabilidad**: una vez confirmada (commit), sobrevive a un corte de luz gracias al [[wal|WAL]].',
      ] },
      { type: 'h', text: 'Niveles de aislamiento' },
      { type: 'table', head: ['Nivel', 'Evita', 'Permite'], rows: [
        ['Read uncommitted', '—', 'Leer datos no confirmados (dirty reads)'],
        ['Read committed (default Postgres)', 'Dirty reads', 'Que un valor cambie entre dos lecturas'],
        ['Repeatable read / snapshot', 'Lo anterior', 'Algunas anomalías de escritura (write skew)'],
        ['Serializable', 'Todo', 'Más conflictos y reintentos'],
      ] },
      { type: 'p', text: 'Más aislamiento = más seguridad pero menos concurrencia. Para casos como "no vender el mismo asiento dos veces" usa `SELECT ... FOR UPDATE`, una restricción `UNIQUE` o control optimista con versión.' },
      { type: 'h', text: 'Transacciones en sistemas distribuidos' },
      { type: 'p', text: 'ACID es fácil dentro de una sola base de datos. Entre servicios o [[sharding|shards]] es difícil: **2PC** (two-phase commit) bloquea si el coordinador falla; por eso los microservicios usan **sagas** (pasos locales con acciones compensatorias) y el patrón [[outbox|outbox]].' },
    ],
    code: {
      title: 'Transferencia atómica',
      java: `// Spring: si algo lanza excepción, se hace rollback de todo
@Transactional
public void transferir(long origen, long destino, long monto) {
    Cuenta a = repo.findByIdForUpdate(origen);   // SELECT ... FOR UPDATE
    Cuenta b = repo.findByIdForUpdate(destino);
    if (a.getSaldo() < monto) throw new SaldoInsuficiente();
    a.setSaldo(a.getSaldo() - monto);
    b.setSaldo(b.getSaldo() + monto);
}`,
      python: `# SQLAlchemy: el bloque "begin" hace commit al salir o rollback si hay excepción
with Session(engine) as s, s.begin():
    a = s.get(Cuenta, origen, with_for_update=True)
    b = s.get(Cuenta, destino, with_for_update=True)
    if a.saldo < monto:
        raise SaldoInsuficiente()
    a.saldo -= monto
    b.saldo += monto`,
    },
    links: [
      { title: 'ACID — Wikipedia (es)', url: 'https://es.wikipedia.org/wiki/ACID', lang: 'es', kind: 'wiki' },
      { title: 'PostgreSQL docs: Transaction Isolation', url: 'https://www.postgresql.org/docs/current/transaction-iso.html', lang: 'en', kind: 'docs' },
      { title: 'Microservices.io: Saga pattern', url: 'https://microservices.io/patterns/data/saga.html', lang: 'en', kind: 'blog' },
      { title: 'Kleppmann: Designing Data-Intensive Applications (cap. 7)', url: 'https://dataintensive.net/', lang: 'en', kind: 'libro' },
    ],
    related: ['wal', 'outbox', 'sharding', 'mutex'],
  },

  btree: {
    lead: 'Un índice es el índice alfabético de un libro de cocina: en vez de hojear 500 páginas buscando "lasaña", vas directo a la página 312.',
    minutes: 7,
    blocks: [
      { type: 'p', text: 'Sin índice, `SELECT * FROM users WHERE email = ?` lee **toda** la tabla (full scan): con 100 millones de filas, segundos. Con un índice, unas pocas lecturas: milisegundos.' },
      { type: 'h', text: 'B-tree: el índice por defecto' },
      { type: 'p', text: 'Un árbol balanceado y muy "ancho": cada nodo tiene cientos de hijos, así que con 3–4 niveles cubre miles de millones de filas (búsqueda O(log n)). Mantiene las claves **ordenadas**, por lo que sirve para igualdad (`=`), rangos (`BETWEEN`, `>`) y `ORDER BY`. Lo usan Postgres, MySQL/InnoDB, SQL Server y Oracle.' },
      { type: 'h', text: 'LSM-tree: optimizado para escrituras' },
      { type: 'p', text: 'Las escrituras van a una tabla en memoria (*memtable*) y a un log; cuando se llena, se vuelca a disco como un archivo ordenado e inmutable (*SSTable*). En segundo plano, la **compactación** fusiona archivos. Escribir es secuencial y rapidísimo; leer puede requerir mirar varios archivos (lo mitigan los [[bloom-filter|Bloom filters]]). Lo usan Cassandra, ScyllaDB, RocksDB y Bigtable.' },
      { type: 'tradeoff', left: { title: 'B-tree', items: ['Lecturas rápidas y predecibles', 'Actualiza en el lugar', 'Escrituras aleatorias más caras'] }, right: { title: 'LSM-tree', items: ['Escrituras masivas y secuenciales', 'Compresión eficiente', 'Lecturas y compactación más costosas'] } },
      { type: 'callout', tone: 'warn', title: 'Los índices no son gratis', text: 'Cada índice se actualiza en cada escritura y ocupa espacio. Un índice compuesto `(pais, ciudad)` sirve para filtrar por país o por país+ciudad, pero **no** solo por ciudad (regla del prefijo izquierdo). Comprueba siempre con `EXPLAIN ANALYZE`.' },
    ],
    links: [
      { title: 'Use The Index, Luke! (guía gratuita de índices SQL)', url: 'https://use-the-index-luke.com/', lang: 'en', kind: 'libro' },
      { title: 'B-tree — Wikipedia (es)', url: 'https://es.wikipedia.org/wiki/%C3%81rbol-B', lang: 'es', kind: 'wiki' },
      { title: 'Log-structured merge-tree — Wikipedia', url: 'https://en.wikipedia.org/wiki/Log-structured_merge-tree', lang: 'en', kind: 'wiki' },
      { title: 'PostgreSQL docs: Using EXPLAIN', url: 'https://www.postgresql.org/docs/current/using-explain.html', lang: 'en', kind: 'docs' },
    ],
    related: ['lsm', 'bloom-filter', 'ssd', 'acid'],
  },

  consensus: {
    lead: 'Consenso es cómo un grupo de amigos decide dónde cenar por chat aunque algunos tengan mala señal: gana lo que acepte la mayoría, y nadie puede cambiarlo después.',
    minutes: 7,
    blocks: [
      { type: 'p', text: 'Varios servidores necesitan acordar algo —quién es el líder, el orden de las escrituras, la configuración— aunque algunos fallen o la red se parta. **Paxos** (1989) fue el primer algoritmo práctico; **Raft** (2014) se diseñó para ser más fácil de entender y es el más usado hoy.' },
      { type: 'h', text: 'Raft en 4 ideas' },
      { type: 'list', ordered: true, items: [
        '**Líder único**: un nodo recibe todas las escrituras y las replica a los seguidores.',
        '**Mayoría**: una entrada se confirma cuando la tiene la mayoría (2 de 3, 3 de 5). Por eso los clústeres tienen tamaño impar.',
        '**Elección**: si los seguidores dejan de recibir latidos (heartbeats), uno se postula; gana quien obtiene la mayoría de votos en ese *term* (mandato).',
        '**Términos numerados**: cada elección incrementa el term; un líder viejo que vuelve con term menor se da cuenta y se retira. Esto evita el [[split-brain|split-brain]].',
      ] },
      { type: 'callout', tone: 'info', title: 'Tolerancia a fallos', text: 'Con 2f+1 nodos toleras f caídos: 3 nodos aguantan 1 fallo, 5 aguantan 2. Agregar nodos aumenta la tolerancia pero hace las escrituras más lentas (hay que esperar a más confirmaciones).' },
      { type: 'h', text: 'Dónde lo encuentras' },
      { type: 'p', text: 'No sueles implementarlo: lo usas. etcd (el cerebro de Kubernetes), Consul, ZooKeeper (ZAB, similar), Kafka con KRaft, CockroachDB, TiDB y MongoDB (elección de primario) se apoyan en consenso. En una entrevista basta con saber que para elegir un líder o un lock distribuido fiable usas uno de estos servicios.' },
    ],
    links: [
      { title: 'The Raft Consensus Algorithm (visualización interactiva y paper)', url: 'https://raft.github.io/', lang: 'en', kind: 'paper' },
      { title: 'The Secret Lives of Data: Raft (animación)', url: 'https://thesecretlivesofdata.com/raft/', lang: 'en', kind: 'video' },
      { title: 'Raft — Wikipedia', url: 'https://en.wikipedia.org/wiki/Raft_(algorithm)', lang: 'en', kind: 'wiki' },
      { title: 'etcd: documentación', url: 'https://etcd.io/docs/', lang: 'en', kind: 'docs' },
    ],
    related: ['split-brain', 'quorum', 'failover', 'cap'],
  },

  eventual: {
    lead: 'La consistencia eventual es como un rumor en la oficina: no todos se enteran al mismo tiempo, pero si nadie cambia la historia, al final todos saben lo mismo.',
    minutes: 6,
    blocks: [
      { type: 'p', text: 'Cuando hay varias copias de un dato ([[replica|réplicas]]), mantenerlas idénticas en todo momento exige coordinarse en cada escritura: lento y frágil ante fallos. La **consistencia eventual** relaja la promesa: las copias pueden diferir un tiempo, pero convergen si dejan de llegar cambios.' },
      { type: 'h', text: 'El espectro de garantías' },
      { type: 'table', head: ['Modelo', 'Promesa', 'Ejemplo de uso'], rows: [
        ['Linealizable (fuerte)', 'Como si hubiera una sola copia', 'Saldo, inventario, locks'],
        ['Causal', 'Si A causó B, nadie ve B sin A', 'Comentarios y respuestas'],
        ['Read-your-writes', 'Tú ves tus propios cambios', 'Editar tu perfil'],
        ['Monotonic reads', 'Nunca "retrocedes" en el tiempo', 'Feeds, listas'],
        ['Eventual', 'Convergerán... algún día', 'Contadores de likes, vistas'],
      ] },
      { type: 'h', text: 'Cómo se resuelven los conflictos' },
      { type: 'list', items: [
        '**Last-write-wins (LWW)**: gana el timestamp mayor. Simple, pero puede perder escrituras.',
        '**Vector clocks / versiones**: detectan escrituras concurrentes y se las entregan a la app para fusionar (el carrito de Amazon Dynamo).',
        '**CRDTs**: estructuras que se fusionan matemáticamente sin conflictos (contadores, conjuntos); los usan editores colaborativos.',
      ] },
      { type: 'callout', tone: 'interview', text: 'Decide por operación, no por sistema: "Los likes son eventuales; el pago, fuerte". Y menciona cómo das read-your-writes al usuario que acaba de escribir.' },
    ],
    links: [
      { title: 'Werner Vogels: Eventually Consistent', url: 'https://www.allthingsdistributed.com/2008/12/eventually_consistent.html', lang: 'en', kind: 'blog' },
      { title: 'Jepsen: Consistency Models (mapa interactivo)', url: 'https://jepsen.io/consistency', lang: 'en', kind: 'docs' },
      { title: 'Paper: Amazon Dynamo (2007)', url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf', lang: 'en', kind: 'paper' },
      { title: 'crdt.tech: recursos sobre CRDTs', url: 'https://crdt.tech/', lang: 'en', kind: 'docs' },
    ],
    related: ['linearizable', 'read-your-writes', 'cap', 'quorum'],
  },

  'thundering-herd': {
    lead: 'Es como cuando abren las puertas de una tienda en Black Friday: todos entran a la vez y la tienda colapsa, aunque durante el día habría atendido a todos sin problema.',
    minutes: 5,
    blocks: [
      { type: 'p', text: 'Un **thundering herd** ocurre cuando muchos clientes hacen lo mismo en el mismo instante. El sistema aguanta la carga promedio, pero no el pico sincronizado.' },
      { type: 'h', text: 'Tres versiones típicas' },
      { type: 'list', items: [
        '**Cache stampede**: expira la clave de la portada y 10.000 peticiones concurrentes van a la base de datos a recalcular lo mismo.',
        '**Reintentos sincronizados**: un servicio se cae 5 s; al volver, todos los clientes reintentan exactamente cada 1 s y lo tumban otra vez.',
        '**Reconexiones masivas**: un servidor de WebSockets reinicia y un millón de clientes se reconectan en el mismo segundo.',
      ] },
      { type: 'h', text: 'Soluciones' },
      { type: 'table', head: ['Técnica', 'Idea'], rows: [
        ['Single-flight / lock de recálculo', 'Solo una petición recalcula; las demás esperan ese resultado'],
        ['Stale-while-revalidate', 'Sirve el valor viejo mientras uno solo lo refresca en segundo plano'],
        ['Expiración temprana probabilística', 'Algunas peticiones refrescan antes de que expire, al azar'],
        ['[[jitter|Jitter]] en TTLs y reintentos', 'Desincroniza: que no todos expiren o reintenten a la vez'],
        ['Backoff exponencial', 'Cada reintento espera más'],
        ['Rate limiting / load shedding', 'Corta el exceso para proteger el origen'],
      ] },
    ],
    code: {
      title: 'Single-flight: una sola recarga por clave',
      java: `import java.util.concurrent.*;

class SingleFlight<V> {
    private final ConcurrentHashMap<String, CompletableFuture<V>> enCurso = new ConcurrentHashMap<>();

    V get(String key, Callable<V> cargar) throws Exception {
        CompletableFuture<V> nuevo = new CompletableFuture<>();
        CompletableFuture<V> existente = enCurso.putIfAbsent(key, nuevo);
        if (existente != null) return existente.get();   // otro ya está cargando: esperar
        try {
            V v = cargar.call();                          // solo este hilo va a la DB
            nuevo.complete(v);
            return v;
        } catch (Exception e) {
            nuevo.completeExceptionally(e);
            throw e;
        } finally {
            enCurso.remove(key);
        }
    }
}`,
      python: `import asyncio

class SingleFlight:
    def __init__(self):
        self._en_curso: dict[str, asyncio.Future] = {}

    async def get(self, key, cargar):
        if key in self._en_curso:              # otro ya está cargando: esperar
            return await self._en_curso[key]
        fut = asyncio.get_running_loop().create_future()
        self._en_curso[key] = fut
        try:
            valor = await cargar()             # solo esta corrutina va a la DB
            fut.set_result(valor)
            return valor
        except Exception as e:
            fut.set_exception(e)
            raise
        finally:
            del self._en_curso[key]`,
    },
    links: [
      { title: 'Thundering herd problem — Wikipedia', url: 'https://en.wikipedia.org/wiki/Thundering_herd_problem', lang: 'en', kind: 'wiki' },
      { title: 'AWS Architecture Blog: Exponential Backoff and Jitter', url: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/', lang: 'en', kind: 'blog' },
      { title: 'Paper: Scaling Memcache at Facebook (leases)', url: 'https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala', lang: 'en', kind: 'paper' },
      { title: 'MDN: Cache-Control stale-while-revalidate', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control', lang: 'en', kind: 'docs' },
    ],
    related: ['jitter', 'retry', 'cache-hit', 'rate-limit'],
  },

  concurrency: {
    lead: 'Concurrencia es un cocinero que alterna entre varias ollas mientras hierven; paralelismo son varios cocineros trabajando a la vez.',
    minutes: 8,
    blocks: [
      { type: 'p', text: 'Un servidor web pasa la mayor parte del tiempo **esperando**: a la base de datos, a otro servicio, al disco. La concurrencia permite atender otras peticiones mientras tanto. Java y Python resuelven esto de formas distintas, y conviene conocerlas para dimensionar servicios.' },
      { type: 'h', text: 'Java' },
      { type: 'list', items: [
        '**Hilos de plataforma**: cada hilo es un hilo del sistema operativo (~1 MB de stack). Un servidor clásico (Tomcat) usa un [[thread-pool|pool]] de ~200: con llamadas lentas, se agota.',
        '**Virtual threads** (Java 21, JEP 444): hilos ligeros gestionados por la JVM. Cuando uno espera I/O, libera el hilo real. Puedes tener millones con código bloqueante normal. En Spring Boot 3.2+: `spring.threads.virtual.enabled=true`.',
        '**Reactivo** (WebFlux, Reactor): no bloqueante con callbacks/streams; muy eficiente pero más complejo de leer y depurar.',
        'Paralelismo real: los hilos corren en todos los núcleos a la vez.',
      ] },
      { type: 'h', text: 'Python' },
      { type: 'list', items: [
        '**GIL**: en CPython solo un hilo ejecuta bytecode Python a la vez. Los hilos sirven para esperar I/O (el GIL se libera al esperar), no para acelerar cálculo.',
        '**asyncio**: una sola hebra con un *event loop*; las corrutinas ceden el control en cada `await`. Ideal para miles de conexiones (FastAPI, aiohttp). Una función bloqueante dentro de una corrutina congela todo el loop.',
        '**multiprocessing / varios workers**: para usar todos los núcleos, se lanzan varios procesos (gunicorn/uvicorn con `--workers N`).',
        'Python 3.13 introdujo una build experimental **sin GIL** (PEP 703, "free-threaded"), aún no es la opción por defecto.',
      ] },
      { type: 'tradeoff', left: { title: 'Trabajo de I/O (red, DB)', items: ['Java: virtual threads o reactivo', 'Python: asyncio o hilos', 'Muchas conexiones, poca CPU'] }, right: { title: 'Trabajo de CPU (cálculo, imágenes)', items: ['Java: hilos en todos los núcleos', 'Python: procesos, o librerías en C (NumPy)', 'O mejor: muévelo a workers asíncronos'] } },
      { type: 'callout', tone: 'interview', text: 'Relaciónalo con la [[littles-law|Ley de Little]]: concurrencia = RPS × latencia. Si cada petición espera 200 ms a un servicio externo y recibes 5.000 RPS, necesitas ~1.000 peticiones en vuelo: virtual threads o asyncio lo hacen barato; un pool de 200 hilos, no.' },
    ],
    code: {
      title: '1.000 llamadas de red concurrentes',
      java: `import java.net.URI;
import java.net.http.*;
import java.util.concurrent.Executors;

var client = HttpClient.newHttpClient();
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {   // Java 21
    for (int i = 0; i < 1_000; i++) {
        executor.submit(() -> client.send(
            HttpRequest.newBuilder(URI.create("https://example.com")).build(),
            HttpResponse.BodyHandlers.discarding()));   // código bloqueante, pero barato
    }
}   // espera a que terminen todas`,
      python: `import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        tareas = [client.get("https://example.com") for _ in range(1_000)]
        respuestas = await asyncio.gather(*tareas)   # todas "a la vez" en un solo hilo
        print(len(respuestas))

asyncio.run(main())`,
    },
    links: [
      { title: 'JEP 444: Virtual Threads', url: 'https://openjdk.org/jeps/444', lang: 'en', kind: 'docs' },
      { title: 'Python docs: asyncio', url: 'https://docs.python.org/3/library/asyncio.html', lang: 'en', kind: 'docs' },
      { title: 'Python glossary: Global Interpreter Lock', url: 'https://docs.python.org/3/glossary.html#term-global-interpreter-lock', lang: 'en', kind: 'docs' },
      { title: 'PEP 703: Making the GIL optional', url: 'https://peps.python.org/pep-0703/', lang: 'en', kind: 'docs' },
      { title: 'Rob Pike: Concurrency is not Parallelism (charla)', url: 'https://go.dev/blog/waza-talk', lang: 'en', kind: 'video' },
    ],
    related: ['thread-pool', 'gil', 'virtual-threads', 'mutex', 'littles-law'],
  },

  backpressure: {
    lead: 'Si llenas un embudo más rápido de lo que drena, rebalsa. Backpressure es que el embudo le diga a quien vierte "¡más despacio!".',
    minutes: 4,
    blocks: [
      { type: 'p', text: 'Cuando un productor genera trabajo más rápido de lo que el consumidor procesa, el exceso se acumula en algún lado: memoria, colas, buffers. Sin un límite, acaba en `OutOfMemoryError`, latencias de minutos o un sistema caído.' },
      { type: 'h', text: 'Estrategias' },
      { type: 'list', items: [
        '**Frenar al productor**: el consumidor pide solo lo que puede procesar (modelo *pull*, como Kafka o Reactive Streams con `request(n)`).',
        '**Colas acotadas**: si la cola está llena, la escritura se bloquea o falla rápido en vez de crecer sin límite.',
        '**Descartar**: tirar mensajes viejos o de baja prioridad ([[load-shedding|load shedding]]), o muestrear (métricas).',
        '**Escalar consumidores**: autoscaling según el [[consumer-lag|lag]].',
        'Hacia afuera: responder **429** / **503** con `Retry-After` para que los clientes bajen el ritmo.',
      ] },
      { type: 'callout', tone: 'tip', text: 'Una cola sin límite no elimina la sobrecarga: solo la esconde y la convierte en latencia. Pon límites y decide explícitamente qué pasa cuando se alcanzan.' },
    ],
    links: [
      { title: 'Reactive Streams (especificación)', url: 'https://www.reactive-streams.org/', lang: 'en', kind: 'docs' },
      { title: 'Fred Hébert: Queues Don\'t Fix Overload', url: 'https://ferd.ca/queues-don-t-fix-overload.html', lang: 'en', kind: 'blog' },
      { title: 'AWS Builders\' Library: Using load shedding to avoid overload', url: 'https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/', lang: 'en', kind: 'blog' },
    ],
    related: ['queue', 'consumer-lag', 'load-shedding', 'rate-limit'],
  },

  'bloom-filter': {
    lead: 'Un Bloom filter es un portero con mala memoria pero honesto: si dice "no estás en la lista", es seguro; si dice "creo que sí", hay que revisar.',
    minutes: 4,
    blocks: [
      { type: 'p', text: 'Es un arreglo de bits y k [[hash|funciones hash]]. Para agregar un elemento, se calculan sus k hashes y se ponen esos bits en 1. Para consultar, si **algún** bit está en 0, el elemento seguro no está; si todos están en 1, probablemente está (puede ser coincidencia: falso positivo). Nunca hay falsos negativos.' },
      { type: 'p', text: 'Con ~10 bits por elemento logras ~1% de falsos positivos: 100 millones de claves en ~120 MB, frente a GB para guardarlas completas.' },
      { type: 'h', text: 'Dónde se usan' },
      { type: 'list', items: [
        'Bases [[lsm|LSM]] (Cassandra, RocksDB): evitar leer de disco SSTables que no contienen la clave.',
        'Cachés: evitar "penetración" de consultas a claves que no existen.',
        'Navegadores: listas de URLs maliciosas; sistemas de recomendación: "¿ya le mostré este artículo?".',
        'Redis los ofrece como módulo (comandos `BF.ADD`, `BF.EXISTS`).',
      ] },
    ],
    code: {
      title: 'Bloom filter mínimo',
      java: `import java.util.BitSet;

class Bloom {
    private final BitSet bits; private final int m, k;
    Bloom(int m, int k) { this.bits = new BitSet(m); this.m = m; this.k = k; }

    private int h(String s, int i) { return Math.floorMod(s.hashCode() * 31 + i * 0x9E3779B9, m); }
    void add(String s) { for (int i = 0; i < k; i++) bits.set(h(s, i)); }
    boolean mightContain(String s) {
        for (int i = 0; i < k; i++) if (!bits.get(h(s, i))) return false;   // seguro que no
        return true;                                                         // probablemente sí
    }
}
// En producción: Guava BloomFilter.create(Funnels.stringFunnel(UTF_8), n, 0.01)`,
      python: `import hashlib

class Bloom:
    def __init__(self, m: int, k: int):
        self.m, self.k, self.bits = m, k, bytearray(m)

    def _idx(self, s: str):
        for i in range(self.k):
            yield int.from_bytes(hashlib.blake2b(f"{i}:{s}".encode(), digest_size=8).digest(), "big") % self.m

    def add(self, s: str) -> None:
        for i in self._idx(s):
            self.bits[i] = 1

    def might_contain(self, s: str) -> bool:
        return all(self.bits[i] for i in self._idx(s))`,
    },
    links: [
      { title: 'Filtro de Bloom — Wikipedia (es)', url: 'https://es.wikipedia.org/wiki/Filtro_de_Bloom', lang: 'es', kind: 'wiki' },
      { title: 'Bloom filter calculator', url: 'https://hur.st/bloomfilter/', lang: 'en', kind: 'docs' },
      { title: 'Redis docs: Bloom filter', url: 'https://redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/', lang: 'en', kind: 'docs' },
    ],
    related: ['hash', 'lsm', 'cache-hit'],
  },

  'optimistic-lock': {
    lead: 'Dos personas editan el mismo documento compartido: en lugar de bloquearlo, cada una guarda y, si la otra guardó antes, el sistema le avisa para que integre los cambios.',
    minutes: 6,
    blocks: [
      { type: 'p', text: 'El bloqueo optimista asume que los conflictos son raros. Cada fila tiene una columna `version`. Lees la fila (con su versión), calculas el cambio y escribes **solo si la versión sigue siendo la misma**. Si otro escribió antes, tu UPDATE afecta 0 filas: relees y reintentas.' },
      { type: 'code', lang: 'sql', code: `-- leer
SELECT balance, version FROM accounts WHERE id = 1;      -- 100, v7
-- escribir solo si nadie cambió la fila
UPDATE accounts SET balance = 70, version = 8
WHERE id = 1 AND version = 7;                             -- 0 filas = conflicto → reintentar` },
      { type: 'code', lang: 'java', title: 'Con JPA / Hibernate', code: `@Entity
class Account {
    @Id Long id;
    long balanceCents;
    @Version long version;   // Hibernate añade "AND version = ?" y lanza OptimisticLockException
}` },
      { type: 'tradeoff', left: { title: 'Optimista', items: ['Sin esperas ni locks retenidos', 'Escala bien con baja contención', 'Requiere reintentos', 'Muchos reintentos si hay mucha contención'] }, right: { title: 'Pesimista (FOR UPDATE)', items: ['Nunca hay que reintentar', 'Bueno con alta contención', 'Los demás esperan', 'Riesgo de deadlocks: bloquea en orden'] } },
      { type: 'callout', tone: 'interview', text: 'Para un descuento simple existe una tercera vía aún más simple: `UPDATE accounts SET balance = balance - 30 WHERE id = 1 AND balance >= 30`. La base lo hace atómico y no necesitas leer antes.' },
    ],
    links: [
      { title: 'Vlad Mihalcea: Optimistic vs pessimistic locking', url: 'https://vladmihalcea.com/optimistic-vs-pessimistic-locking/', lang: 'en', kind: 'blog' },
      { title: 'Jakarta Persistence: @Version', url: 'https://jakarta.ee/specifications/persistence/3.1/apidocs/jakarta.persistence/jakarta/persistence/version', lang: 'en', kind: 'docs' },
      { title: 'PostgreSQL: Explicit Locking', url: 'https://www.postgresql.org/docs/current/explicit-locking.html', lang: 'en', kind: 'docs' },
    ],
    related: ['pessimistic-lock', 'lost-update', 'acid', 'race-condition'],
  },

  tcc: {
    lead: 'Reservar mesa en un restaurante: primero apartan la mesa (Try); si llegas, te sientas (Confirm); si cancelas, la liberan (Cancel).',
    minutes: 7,
    blocks: [
      { type: 'p', text: 'TCC divide una transacción distribuida en dos fases de **negocio** (no de base de datos). En la fase **Try** cada participante valida y reserva recursos (congela fondos, aparta stock). Si todos responden bien, el coordinador envía **Confirm** para consumir lo reservado; si alguno falla, envía **Cancel** para liberarlo.' },
      { type: 'table', head: ['Problema', 'Qué pasa', 'Cómo se resuelve'], rows: [
        ['Idempotencia', 'Confirm o Cancel llegan dos veces', 'Registrar el estado de cada transacción y no repetir el efecto'],
        ['Cancelación vacía', 'Llega Cancel sin haber recibido el Try', 'Registrar la transacción como cancelada sin liberar nada'],
        ['Suspensión', 'Llega el Try después de su Cancel', 'Rechazarlo: si congelaras, nadie liberaría esos fondos'],
      ] },
      { type: 'tradeoff', left: { title: 'TCC', items: ['Nunca se consume lo que habrá que devolver', 'Aislamiento por reservas', 'Cada servicio implementa 3 operaciones', 'Ideal para fondos e inventario'] }, right: { title: 'Saga', items: ['Ejecuta y compensa', 'Más simple de implementar', 'Estados intermedios visibles', 'Compensar a veces cuesta (comisiones, correos)'] } },
      { type: 'callout', tone: 'interview', text: 'Si te preguntan cómo bloquear fondos entre servicios sin 2PC, TCC es la respuesta madura. Menciona las tres trampas (idempotencia, cancelación vacía y suspensión) y que el registro de transacciones se guarda en la misma transacción local que el saldo.' },
    ],
    links: [
      { title: 'Seata: TCC mode', url: 'https://seata.apache.org/docs/dev/mode/tcc-mode/', lang: 'en', kind: 'docs' },
      { title: 'microservices.io: Saga', url: 'https://microservices.io/patterns/data/saga.html', lang: 'en', kind: 'docs' },
      { title: 'Pat Helland: Life beyond Distributed Transactions', url: 'https://queue.acm.org/detail.cfm?id=3025012', lang: 'en', kind: 'paper' },
    ],
    related: ['saga', 'two-pc', 'idempotency', 'outbox'],
  },

  canary: {
    lead: 'Los mineros bajaban con un canario: si el pájaro enfermaba, había gas y todos salían antes de que fuera tarde.',
    minutes: 6,
    blocks: [
      { type: 'p', text: 'Un despliegue canary envía un porcentaje pequeño del tráfico (1%) a la versión nueva y lo compara **al mismo tiempo** con la versión estable. Si las métricas se mantienen, sube por pasos (5%, 25%, 50%, 100%); si empeoran, rollback.' },
      { type: 'list', items: [
        '**Qué comparar**: tasa de error, p95/p99, saturación y métricas de negocio (tasa de aprobación de pagos).',
        '**Ruido**: con 1% del tráfico hay pocas muestras; un solo error mueve mucho el porcentaje. Define un tiempo mínimo de observación por paso.',
        '**Automatizar**: Argo Rollouts, Flagger, AWS CodeDeploy o Cloud Deploy hacen los pasos, el análisis y el rollback solos.',
        '**Datos**: el código se revierte fácil; los datos, no. Combínalo con migraciones expand/contract.',
      ] },
      { type: 'callout', tone: 'interview', text: '"Cada despliegue es canary con análisis automático contra la versión estable y rollback automático si el error rate sube más de 1 punto o el p99 más de 100 ms durante 15 minutos en cualquier paso."' },
    ],
    links: [
      { title: 'Google SRE Workbook: Canarying Releases', url: 'https://sre.google/workbook/canarying-releases/', lang: 'en', kind: 'libro' },
      { title: 'Argo Rollouts: Canary', url: 'https://argoproj.github.io/argo-rollouts/features/canary/', lang: 'en', kind: 'docs' },
      { title: 'Martin Fowler: Canary Release', url: 'https://martinfowler.com/bliki/CanaryRelease.html', lang: 'en', kind: 'blog' },
    ],
    related: ['blue-green', 'feature-flag', 'expand-contract', 'burn-rate'],
  },
}
