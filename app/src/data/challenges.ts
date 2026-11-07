import type { NodeKind } from '@/lab/catalog'

export interface Challenge {
  id: string
  title: string
  emoji: string
  difficulty: 1 | 2 | 3
  story: string
  rps: number
  readRatio: number // 0..1 (resto = escrituras)
  staticShare: number // fracción de lecturas que son estáticas/media (cacheables en CDN)
  cacheHit: number // hit rate esperado si hay caché de datos
  p99: number // ms
  availability: number // p.ej. 0.999
  budget: number // USD/mes
  requires: NodeKind[]
  hints: string[]
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'blog', title: 'Blog personal', emoji: '✍️', difficulty: 1,
    story: 'Un blog con picos cuando un post llega a Hacker News. Casi todo son lecturas.',
    rps: 400, readRatio: 0.97, staticShare: 0.3, cacheHit: 0.9, p99: 300, availability: 0.99, budget: 600, requires: [],
    hints: ['Un cliente, un load balancer, dos servidores de app y una base SQL bastan.', '¿Qué pasa si solo tienes un servidor de aplicación y cae?'],
  },
  {
    id: 'url-shortener', title: 'Acortador de URLs', emoji: '🔗', difficulty: 2,
    story: 'Millones de redirecciones al día. 100 lecturas por cada escritura. Las redirecciones deben ser instantáneas.',
    rps: 12000, readRatio: 0.99, staticShare: 0, cacheHit: 0.92, p99: 80, availability: 0.999, budget: 4000, requires: ['cache'],
    hints: ['Las URLs populares se repiten muchísimo: una caché tiene un hit rate altísimo.', 'Con 12k RPS, ¿cuántos servidores de app de 1k RPS necesitas? Deja margen (~70% de uso).', 'Si la DB primaria se satura con lecturas, añade réplicas.'],
  },
  {
    id: 'ecommerce', title: 'E-commerce en Black Friday', emoji: '🛒', difficulty: 2,
    story: 'Catálogo con muchas imágenes, carritos y pedidos. Hoy es Black Friday: 25k RPS.',
    rps: 25000, readRatio: 0.9, staticShare: 0.5, cacheHit: 0.85, p99: 200, availability: 0.9995, budget: 9000, requires: ['cdn', 'queue'],
    hints: ['La mitad de las lecturas son imágenes y assets: una CDN las saca del camino.', 'Procesar pedidos (email, factura, inventario) no necesita ser síncrono: encola.', 'Para 99.95% necesitas redundancia en cada capa crítica, incluida la DB (standby).'],
  },
  {
    id: 'chat', title: 'Mensajería en tiempo real', emoji: '💬', difficulty: 3,
    story: 'Una app de chat: la mitad del tráfico son mensajes nuevos. Volumen de escritura enorme y el historial crece sin parar.',
    rps: 30000, readRatio: 0.5, staticShare: 0.05, cacheHit: 0.6, p99: 150, availability: 0.999, budget: 12000, requires: ['nosql', 'queue'],
    hints: ['15k escrituras/s no caben en un SQL primario. Una NoSQL wide-column escala escrituras horizontalmente.', 'La entrega a los destinatarios (fan-out, push) es trabajo asíncrono.', 'Workers: cada uno procesa ~500 msg/s.'],
  },
  {
    id: 'video', title: 'Plataforma de video', emoji: '🎬', difficulty: 3,
    story: 'Streaming de video: el 85% del tráfico de lectura son segmentos de video. Las subidas se transcodifican.',
    rps: 40000, readRatio: 0.98, staticShare: 0.85, cacheHit: 0.8, p99: 250, availability: 0.9995, budget: 10000, requires: ['cdn', 'storage', 'queue'],
    hints: ['El video vive en object storage y se sirve por CDN; nunca desde tus servidores de app.', 'La transcodificación es un trabajo pesado y asíncrono: cola + workers.', 'Los metadatos (títulos, likes) sí van por la app con caché.'],
  },
  {
    id: 'payments', title: 'Sistema de pagos', emoji: '💳', difficulty: 3,
    story: 'Procesas pagos de miles de comercios. Cada caída cuesta dinero real. La consistencia es innegociable.',
    rps: 3000, readRatio: 0.7, staticShare: 0, cacheHit: 0.5, p99: 400, availability: 0.9999, budget: 8000, requires: ['gateway', 'sql', 'queue'],
    hints: ['Necesitas transacciones ACID: SQL con standby síncrono (×2) para failover.', 'Un API Gateway aplica auth y rate limiting por comercio.', '99.99% exige que NINGUNA capa crítica tenga una sola instancia.', 'Webhooks y conciliación son asíncronos.'],
  },
]
