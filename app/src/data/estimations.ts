export interface EstimationProblem {
  id: string
  title: string
  prompt: string
  givens: string[]
  unit: 'rps' | 'bytes' | 'count' | 'bps'
  answer: number
  steps: string[]
  takeaway: string
}

export const ESTIMATIONS: EstimationProblem[] = [
  {
    id: 'tweets-qps', title: 'QPS de escritura de tweets', unit: 'rps',
    prompt: '¿Cuántos tweets por segundo se escriben en promedio?',
    givens: ['300 M usuarios activos diarios', 'Cada usuario publica 2 tweets al día'],
    answer: 7000,
    steps: ['300 M × 2 = 600 M tweets/día', '600 M / 86.400 s ≈ 600 M / 10⁵ = 6.000', '≈ 6.900 /s (pico ×2 ≈ 14k/s)'],
    takeaway: 'Unos miles de escrituras/s caben en un clúster pequeño de DB; el reto real son las lecturas del timeline.',
  },
  {
    id: 'insta-storage', title: 'Almacenamiento de fotos por año', unit: 'bytes',
    prompt: '¿Cuánto almacenamiento nuevo (sin réplicas) se necesita al año?',
    givens: ['500 M usuarios activos diarios', '10% sube 1 foto al día', 'Foto promedio: 2 MB (incluyendo miniaturas)'],
    answer: 3.65e16,
    steps: ['500 M × 10% = 50 M fotos/día', '50 M × 2 MB = 100 TB/día', '100 TB × 365 ≈ 36,5 PB/año'],
    takeaway: 'Petabytes → object storage (S3/GCS/Blob) con lifecycle policies, nunca una base de datos.',
  },
  {
    id: 'url-reads', title: 'Lecturas de un acortador', unit: 'rps',
    prompt: '¿Cuántas redirecciones por segundo en promedio?',
    givens: ['100 M URLs nuevas al día', 'Ratio lectura:escritura 100:1'],
    answer: 115000,
    steps: ['Escrituras: 100 M / 10⁵ ≈ 1.000–1.160 /s', 'Lecturas: × 100 ≈ 115.000 /s', 'En pico: ~250k/s'],
    takeaway: '100k+ RPS de lecturas por clave → caché (Redis) con hit rate alto antes de la DB.',
  },
  {
    id: 'chat-bandwidth', title: 'Ancho de banda de un chat', unit: 'bps',
    prompt: '¿Cuál es el ancho de banda de entrada (ingress) promedio en bits por segundo?',
    givens: ['50 M usuarios activos diarios', '40 mensajes por usuario al día', '1 KB por mensaje (incluyendo metadatos)'],
    answer: 1.85e8,
    steps: ['50 M × 40 = 2.000 M mensajes/día', '2 × 10⁹ / 86.400 ≈ 23k msgs/s', '23k × 1 KB = 23 MB/s ≈ 185 Mbps'],
    takeaway: 'El texto es barato: el ancho de banda lo dominan media y fan-out a grupos, no los mensajes.',
  },
  {
    id: 'servers-needed', title: 'Servidores de aplicación', unit: 'count',
    prompt: '¿Cuántas instancias de app necesitas en el pico (al 70% de utilización objetivo)?',
    givens: ['Pico de 35.000 RPS', 'Cada instancia aguanta 1.000 RPS al 100%', 'Objetivo: 70% de uso máximo para tener margen'],
    answer: 50,
    steps: ['Capacidad útil por instancia: 1.000 × 0,7 = 700 RPS', '35.000 / 700 = 50 instancias', 'Repartidas en ≥ 3 AZs (~17 por AZ)'],
    takeaway: 'Nunca dimensiones al 100%: la latencia se dispara cerca de la saturación (teoría de colas).',
  },
  {
    id: 'cache-size', title: 'Tamaño de caché', unit: 'bytes',
    prompt: '¿Cuánta RAM para cachear el 20% de las URLs leídas al día?',
    givens: ['Se leen 10.000 M de redirecciones al día', 'Pero solo 100 M URLs distintas', 'Cada entrada en caché: 500 B', 'Regla 80/20: cachear el 20% más popular'],
    answer: 1e10,
    steps: ['URLs distintas: 100 M', '20% → 20 M entradas', '20 M × 500 B = 10 GB'],
    takeaway: '10 GB cabe en un solo nodo de Redis; replica para disponibilidad, no por capacidad.',
  },
  {
    id: 'video-storage', title: 'Almacenamiento de video diario', unit: 'bytes',
    prompt: '¿Cuánto almacenamiento por día (todas las resoluciones, sin réplicas)?',
    givens: ['Se suben 500 horas de video por minuto', 'Todas las resoluciones juntas: ~3 GB por hora de video'],
    answer: 2.16e15,
    steps: ['500 h/min × 1.440 min = 720.000 h/día', '720.000 × 3 GB = 2,16 PB/día'],
    takeaway: 'Escala de PB/día: almacenamiento en capas (caliente/frío) y CDN para el egress.',
  },
  {
    id: 'driver-updates', title: 'Updates de ubicación', unit: 'rps',
    prompt: '¿Cuántas actualizaciones de ubicación por segundo en el pico?',
    givens: ['3 M de conductores conectados en el pico', 'Cada uno envía su ubicación cada 4 s'],
    answer: 750000,
    steps: ['3 M / 4 s = 750.000 updates/s'],
    takeaway: '750k escrituras/s efímeras → en memoria, sharded por celda geográfica; no en una DB transaccional.',
  },
]

export function scoreEstimate(guess: number, answer: number): number {
  if (!(guess > 0)) return 0
  const err = Math.abs(Math.log10(guess / answer))
  if (err <= 0.15) return 100 // ±~40%
  if (err <= 0.3) return 80 // ±2×
  if (err <= 0.5) return 55 // ±3×
  if (err <= 1) return 25 // ±10×
  return 5
}
