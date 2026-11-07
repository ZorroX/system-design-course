/**
 * La Torre del Vigía — diagnóstico de incidentes reales en producción (Linux + JVM + SQL).
 * Las salidas imitan las herramientas reales: top, jstack, jstat, jcmd, Eclipse MAT, EXPLAIN ANALYZE.
 * Lo usan el puzle de NIMBUS y el simulador "Terminal de guardia" del curso.
 */

export interface Cmd {
  id: string
  cmd: string
  /** por qué usarlo (se muestra en el curso al pasar el cursor) */
  hint: string
  out: string
  requires?: string[]
  restart?: boolean
}

export interface Choice {
  q: string
  options: string[]
  answer: number
  explain: string
}

export interface Incident {
  id: string
  title: string
  icon: string
  alert: string
  commands: Cmd[]
  diagnosis: Choice
  fix: Choice
  optimal: number
  lesson: string
}

const RESTART = (back: string): Cmd => ({
  id: 'restart',
  cmd: 'sudo systemctl restart payments-api',
  hint: 'Reiniciar mitiga a veces, pero borra la evidencia (hilos, heap). Antes, captura dumps.',
  out: `Servicio reiniciado. ${back}\n⚠ Perdiste el estado de la JVM del momento del fallo: hilos, heap y conexiones.`,
  restart: true,
})

export const INCIDENTS: Incident[] = [
  {
    id: 'cpu',
    title: 'CPU al 100%',
    icon: '🔥',
    alert: '🔴 ALERTA payments-api · pay-api-3: CPU 100% desde las 03:12 · p99 de /v1/charges = 4,8 s',
    optimal: 4,
    lesson: 'Proceso caliente (top) → hilo caliente (top -H) → id en hexadecimal (printf) → qué ejecuta ese hilo (jstack). Toma 2–3 dumps separados unos segundos para confirmar.',
    commands: [
      {
        id: 'top',
        cmd: 'top',
        hint: 'Primer vistazo: qué proceso consume CPU y memoria.',
        out: `top - 03:14:07 up 12 days, load average: 7.92, 7.40, 5.11
%Cpu(s): 98.7 us,  0.9 sy,  0.0 wa,  0.4 id
MiB Mem :  7972.1 total,  1203.4 free,  4410.2 used
  PID USER   %CPU  %MEM  COMMAND
 4242 app   396.0  41.2  java -jar payments-api.jar
  812 root    1.3   0.4  node_exporter`,
      },
      {
        id: 'topH',
        cmd: 'top -H -p 4242',
        requires: ['top'],
        hint: 'Muestra los HILOS del proceso Java y cuánta CPU usa cada uno.',
        out: `  TID USER   %CPU  COMMAND
 4311 app    99.7  http-nio-8080-exec-17
 4318 app    99.3  http-nio-8080-exec-24
 4297 app    98.9  http-nio-8080-exec-3
 4320 app    97.8  http-nio-8080-exec-26
 4251 app     0.7  G1 Young RemSet`,
      },
      {
        id: 'printf',
        cmd: "printf '%x\\n' 4311",
        requires: ['topH'],
        hint: 'jstack muestra los ids de hilo nativos (nid) en hexadecimal.',
        out: '10d7',
      },
      {
        id: 'jstack',
        cmd: "jstack 4242 | grep -A 12 'nid=0x10d7'",
        requires: ['printf'],
        hint: 'Qué está ejecutando exactamente ese hilo.',
        out: `"http-nio-8080-exec-17" #63 daemon prio=5 nid=0x10d7 runnable
   java.lang.Thread.State: RUNNABLE
    at java.util.regex.Pattern$Loop.match(Pattern.java:5045)
    at java.util.regex.Pattern$GroupTail.match(Pattern.java:4931)
    at java.util.regex.Pattern$Loop.match(Pattern.java:5052)
    ... 2.987 frames iguales ...
    at java.util.regex.Matcher.matches(Matcher.java:729)
    at com.pay.validation.CardHolderValidator.isValid(CardHolderValidator.java:31)
    at com.pay.api.ChargeController.charge(ChargeController.java:58)`,
      },
      {
        id: 'jstat',
        cmd: 'jstat -gcutil 4242 1000 3',
        hint: 'Estado del GC cada segundo: ocupación de las generaciones y pausas.',
        out: `  S0     S1     E      O      M     YGC   YGCT   FGC  FGCT    GCT
  0.00 100.00  41.23  38.10  96.4   812  6.211    0  0.000  6.211
  0.00 100.00  55.87  38.10  96.4   812  6.211    0  0.000  6.211
  0.00 100.00  63.02  38.10  96.4   812  6.211    0  0.000  6.211
(Old al 38% y 0 Full GC: el GC no es el problema)`,
      },
      {
        id: 'log',
        cmd: 'tail -n 4 /var/log/payments/app.log',
        hint: 'Las últimas líneas del log de la aplicación.',
        out: `03:13:58 WARN  ChargeController - slow request 9.8 s POST /v1/charges merchant=m_8812
03:13:59 WARN  ChargeController - slow request 11.2 s POST /v1/charges merchant=m_8812
03:14:01 INFO  ChargeController - cardholder="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA!"
03:14:02 WARN  ChargeController - slow request 12.9 s POST /v1/charges merchant=m_8812`,
      },
      {
        id: 'free',
        cmd: 'free -m',
        hint: 'Memoria del sistema operativo.',
        out: `        total   used   free  shared  buff/cache  available
Mem:     7972   4410   1203      12        2358       3290
Swap:       0      0      0`,
      },
      RESTART('La CPU baja… y a los 4 minutos vuelve al 100%.'),
    ],
    diagnosis: {
      q: '¿Cuál es la causa raíz?',
      options: ['GC thrashing: el heap está lleno', 'Una regex con backtracking catastrófico en CardHolderValidator, disparada por entradas maliciosas', 'Demasiado tráfico: faltan instancias', 'Fuga de memoria nativa'],
      answer: 1,
      explain: 'Varios hilos HTTP están RUNNABLE dentro de Pattern$Loop.match con miles de frames: una regex con cuantificadores anidados como (A+)+ explota de forma exponencial con entradas como "AAAA…!". El GC está sano (0 Full GC).',
    },
    fix: {
      q: '¿Qué arreglo propones?',
      options: ['Escalar a 4× instancias', 'Reescribir la regex sin cuantificadores anidados y validar la longitud antes; mientras tanto, bloquear el patrón en el WAF', 'Subir -Xmx a 8 GB', 'Reiniciar el servicio cada hora con un cron'],
      answer: 1,
      explain: 'Escalar solo reparte el ataque. Se corrige la regex (o se usa un motor lineal como RE2), se limita la longitud del campo y se mitiga en el borde mientras sale el fix.',
    },
  },
  {
    id: 'leak',
    title: 'Fuga de memoria',
    icon: '💧',
    alert: '🟠 ALERTA payments-api: p99 sube cada hora y aparece "java.lang.OutOfMemoryError: Java heap space"',
    optimal: 4,
    lesson: 'Heap lleno incluso tras un Full GC = fuga. Histograma de clases (qué crece) → heap dump → análisis de dominadores en MAT (quién lo retiene: el camino a las GC roots).',
    commands: [
      {
        id: 'jstat',
        cmd: 'jstat -gcutil 4242 2000 3',
        hint: 'Si Old sigue lleno después de cada Full GC, hay objetos que nunca se liberan.',
        out: `  S0     S1     E       O      M     YGC   YGCT    FGC   FGCT     GCT
  0.00   0.00  100.00  99.81  95.2  9120  71.3    214  388.12  459.4
  0.00   0.00  100.00  99.87  95.2  9120  71.3    216  392.30  463.6
  0.00   0.00  100.00  99.90  95.2  9120  71.3    218  396.61  467.9
(Full GC cada segundo y Old no baja del 99,8%)`,
      },
      {
        id: 'histo',
        cmd: 'jcmd 4242 GC.class_histogram | head -6',
        hint: 'Cuántas instancias y bytes hay de cada clase (equivale a jmap -histo:live).',
        out: ` num   #instances        #bytes  class name
   1:     4,812,331   731,474,312  [B
   2:     4,811,904   192,476,160  com.pay.idem.StoredResponse
   3:     4,811,904   115,485,696  java.util.concurrent.ConcurrentHashMap$Node
   4:       120,551     9,644,080  java.lang.String`,
      },
      {
        id: 'dump',
        cmd: 'jcmd 4242 GC.heap_dump /tmp/pay.hprof',
        hint: 'Foto completa del heap para analizarla offline (también: jmap -dump:live,format=b,file=…).',
        out: `4242:
Dumping heap to /tmp/pay.hprof ...
Heap dump file created [1,94 GB in 6,1 secs]`,
      },
      {
        id: 'mat',
        cmd: 'mat /tmp/pay.hprof  →  Leak Suspects',
        requires: ['dump'],
        hint: 'Eclipse MAT: árbol de dominadores y sospechosos de fuga.',
        out: `Problem Suspect 1
One instance of "com.pay.idem.IdempotencyCache" occupies 1.041.322.104 bytes (93,4%).
The memory is accumulated in one instance of "java.util.concurrent.ConcurrentHashMap$Node[]".
Shortest path to GC roots:
  class com.pay.idem.IdempotencyCache
    └─ static RESPONSES  java.util.concurrent.ConcurrentHashMap  (4.811.904 entries)`,
      },
      {
        id: 'top',
        cmd: 'top',
        hint: 'Primer vistazo al proceso.',
        out: `  PID USER   %CPU  %MEM  COMMAND
 4242 app   181.0  79.6  java -jar payments-api.jar
(la CPU la consumen los hilos del GC intentando liberar memoria)`,
      },
      {
        id: 'log',
        cmd: 'tail -n 3 /var/log/payments/app.log',
        hint: 'Últimas líneas del log.',
        out: `14:02:11 ERROR [exec-91] java.lang.OutOfMemoryError: Java heap space
    at java.util.concurrent.ConcurrentHashMap.putVal(ConcurrentHashMap.java:1075)
    at com.pay.idem.IdempotencyCache.put(IdempotencyCache.java:22)`,
      },
      RESTART('La memoria vuelve a crecer y en 3 horas se repite el OOM.'),
    ],
    diagnosis: {
      q: '¿Cuál es la causa raíz?',
      options: ['El heap es demasiado pequeño para el tráfico', 'Un ConcurrentHashMap estático de respuestas idempotentes sin expiración que crece sin límite', 'Una fuga de hilos', 'El GC G1 tiene un bug'],
      answer: 1,
      explain: 'MAT muestra que el campo estático RESPONSES retiene el 93% del heap con 4,8 M entradas. Nunca se borran: es una fuga clásica de "caché casera" sin TTL.',
    },
    fix: {
      q: '¿Qué arreglo propones?',
      options: ['Subir -Xmx al doble', 'Caché acotada con expiración (Caffeine maximumSize + expireAfterWrite 24 h) o guardar las claves en Redis/BD con TTL; y activar -XX:+HeapDumpOnOutOfMemoryError', 'Llamar a System.gc() cada minuto', 'Reiniciar los pods cada 2 horas'],
      answer: 1,
      explain: 'Más heap solo retrasa el OOM. Toda caché necesita límite y expiración. HeapDumpOnOutOfMemoryError deja la evidencia lista la próxima vez.',
    },
  },
  {
    id: 'pool',
    title: 'Pool agotado y SQL lento',
    icon: '🐢',
    alert: '🔴 ALERTA payments-api: 38% de timeouts en GET /v1/merchants/{id}/payments · CPU del servicio: 6%',
    optimal: 3,
    lesson: 'CPU baja + timeouts = los hilos ESPERAN algo. El thread dump muestra a quién (el pool de conexiones), pg_stat_statements qué consulta acapara las conexiones y EXPLAIN ANALYZE por qué es lenta.',
    commands: [
      {
        id: 'top',
        cmd: 'top',
        hint: 'Primer vistazo.',
        out: `  PID USER   %CPU  %MEM  COMMAND
 4242 app     6.1  38.0  java -jar payments-api.jar
(casi no hay CPU: los hilos no calculan, esperan)`,
      },
      {
        id: 'jstack',
        cmd: 'jstack 4242 | resumen de estados',
        hint: 'En qué están TODOS los hilos.',
        out: `186 hilos "http-nio-8080-exec-*" TIMED_WAITING
    at java.util.concurrent.SynchronousQueue.poll
    at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:181)
    at org.springframework.jdbc.datasource.DataSourceUtils.doGetConnection
 10 hilos RUNNABLE
    at java.net.SocketInputStream.socketRead0(Native Method)
    at org.postgresql.core.v3.QueryExecutorImpl.execute
    at com.pay.repo.PaymentRepository.findByMerchant(PaymentRepository.java:44)`,
      },
      {
        id: 'log',
        cmd: 'tail -n 2 /var/log/payments/app.log',
        hint: 'Últimas líneas del log.',
        out: `11:40:02 WARN  HikariPool-1 - Connection is not available, request timed out after 30000ms
          (total=10, active=10, idle=0, waiting=186)`,
      },
      {
        id: 'stat',
        cmd: 'psql: pg_stat_statements (consultas más costosas)',
        hint: 'Qué consultas consumen más tiempo total en la base de datos.',
        out: ` query                                                         | calls  | mean_exec_time
---------------------------------------------------------------+--------+---------------
 SELECT * FROM payments WHERE merchant_id = $1 AND status = $2  | 51,220 | 8,412 ms
   ORDER BY created_at DESC LIMIT 50                           |        |`,
      },
      {
        id: 'explain',
        cmd: 'psql: EXPLAIN ANALYZE <la consulta lenta>',
        requires: ['stat'],
        hint: 'El plan REAL de ejecución de la consulta con tiempos.',
        out: `Limit  (actual time=8391..8391 rows=50)
  ->  Sort  (Sort Key: created_at DESC)  Sort Method: top-N heapsort
        ->  Seq Scan on payments  (cost=0.00..1893422.00 rows=4100)
              (actual time=0.03..8302 rows=4210 loops=1)
              Filter: ((merchant_id = 'm_8812') AND (status = 'CAPTURED'))
              Rows Removed by Filter: 48113559
Execution Time: 8391.4 ms`,
      },
      {
        id: 'desc',
        cmd: 'psql -c "\\d payments"',
        hint: 'Estructura e índices de la tabla.',
        out: `Indexes:
    "payments_pkey" PRIMARY KEY, btree (id)
    "idx_payments_created_at" btree (created_at)`,
      },
      RESTART('Durante 2 minutos todo va bien… hasta que las consultas lentas vuelven a llenar el pool.'),
    ],
    diagnosis: {
      q: '¿Cuál es la causa raíz?',
      options: ['El pool de Hikari es demasiado pequeño', 'Cada consulta hace un Seq Scan de 48 M filas (no hay índice para merchant_id + status): tarda 8 s y retiene una conexión; el pool de 10 se agota', 'La red con la base de datos tiene latencia', 'Tomcat tiene pocos hilos'],
      answer: 1,
      explain: 'El pool no es la causa, es el síntoma: 10 conexiones ocupadas 8 s cada una = 1,2 consultas/s de capacidad. El plan muestra Seq Scan y 48 M filas descartadas.',
    },
    fix: {
      q: '¿Qué arreglo propones?',
      options: ['Subir el pool de Hikari a 300 conexiones', 'CREATE INDEX CONCURRENTLY ON payments (merchant_id, status, created_at DESC)', 'Poner Kafka entre la API y la base de datos', 'Un índice solo sobre status'],
      answer: 1,
      explain: 'Índice compuesto: igualdades primero (merchant_id, status) y luego la columna de orden (created_at): la consulta pasa a leer 50 filas del índice. CONCURRENTLY evita bloquear escrituras. Más conexiones hundirían la base y Kafka sería sobreingeniería (KISS).',
    },
  },
  {
    id: 'deadlock',
    title: 'Transferencias colgadas',
    icon: '🔒',
    alert: '🟠 ALERTA transfers-api: 12 transferencias sin terminar desde hace 10 min · CPU 2% · sin errores en el log',
    optimal: 1,
    lesson: 'Sin CPU, sin errores y trabajo detenido: piensa en bloqueos. jstack detecta los deadlocks de monitores Java automáticamente ("Found one Java-level deadlock").',
    commands: [
      {
        id: 'top',
        cmd: 'top',
        hint: 'Primer vistazo.',
        out: `  PID USER   %CPU  %MEM  COMMAND
 5150 app     2.0  22.0  java -jar transfers-api.jar`,
      },
      {
        id: 'jstack',
        cmd: 'jstack 5150 | tail -n 22',
        hint: 'Al final del thread dump, la JVM informa los deadlocks que detecta.',
        out: `Found one Java-level deadlock:
=============================
"transfer-worker-3":
  waiting to lock monitor 0x00007f3a1c004e28 (object 0x6c1a2b3c0, a com.pay.Account),
  which is held by "transfer-worker-7"
"transfer-worker-7":
  waiting to lock monitor 0x00007f3a1c0071f8 (object 0x6c1a2b410, a com.pay.Account),
  which is held by "transfer-worker-3"

"transfer-worker-3":
    at com.pay.TransferService.transfer(TransferService.java:27)
    - waiting to lock <0x6c1a2b3c0> (cuenta B)
    - locked <0x6c1a2b410> (cuenta A)
"transfer-worker-7":
    at com.pay.TransferService.transfer(TransferService.java:27)
    - waiting to lock <0x6c1a2b410> (cuenta A)
    - locked <0x6c1a2b3c0> (cuenta B)`,
      },
      {
        id: 'locks',
        cmd: 'psql -c "SELECT count(*) FROM pg_locks WHERE NOT granted"',
        hint: '¿Hay bloqueos esperando en la base de datos?',
        out: ` count
-------
     0
(la base de datos no tiene bloqueos en espera)`,
      },
      {
        id: 'log',
        cmd: 'tail -n 3 /var/log/transfers/app.log',
        hint: 'Últimas líneas del log.',
        out: `10:21:07 INFO  [transfer-worker-3] transfer A → B $40 started
10:21:07 INFO  [transfer-worker-7] transfer B → A $15 started
(y nada más)`,
      },
      RESTART('Se liberan… hasta que otras dos transferencias cruzadas coinciden.'),
    ],
    diagnosis: {
      q: '¿Cuál es la causa raíz?',
      options: ['La base de datos está bloqueada', 'Deadlock: transfer(A→B) bloquea A y luego B, y transfer(B→A) bloquea B y luego A', 'Faltan hilos en el pool de workers', 'Una fuga de memoria'],
      answer: 1,
      explain: 'Cada hilo tiene el candado que el otro necesita (espera circular). pg_locks vacío descarta la base de datos.',
    },
    fix: {
      q: '¿Qué arreglo propones?',
      options: ['Más hilos para que haya siempre alguno libre', 'Adquirir los candados siempre en el mismo orden (por id de cuenta) o usar tryLock con timeout', 'Un synchronized global sobre todo el servicio', 'Reiniciar cuando ocurra'],
      answer: 1,
      explain: 'El orden global rompe la espera circular. Un candado global también "funciona" pero serializa todas las transferencias. En SQL, lo mismo: SELECT … FOR UPDATE ordenando por id.',
    },
  },
]

export function towerStars(used: number, optimal: number, restarted: boolean) {
  if (restarted) return 1
  if (used <= optimal + 1) return 3
  if (used <= optimal + 3) return 2
  return 1
}
