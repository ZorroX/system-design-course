const PRIMER = 'https://github.com/donnemartin/system-design-primer'

export const R = {
  primer: (anchor = '', title = 'System Design Primer') => ({ title: `Primer · ${title}`, url: `${PRIMER}${anchor}` }),
  karan: { title: 'karanpratapsingh/system-design (curso)', url: 'https://github.com/karanpratapsingh/system-design' },
  ashish: { title: 'ashishps1/awesome-system-design-resources', url: 'https://github.com/ashishps1/awesome-system-design-resources' },
  scalability: { title: 'binhnguyennus/awesome-scalability', url: 'https://github.com/binhnguyennus/awesome-scalability' },
  madd: { title: 'madd86/awesome-system-design', url: 'https://github.com/madd86/awesome-system-design' },
  grokking: { title: 'design-gurus/grokking-system-design', url: 'https://github.com/design-gurus/grokking-system-design' },
  dynamo: { title: 'Paper: Amazon Dynamo (2007)', url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf' },
  ddia: { title: 'Libro: Designing Data-Intensive Applications', url: 'https://dataintensive.net/' },
  awsBackoff: { title: 'AWS: Exponential Backoff and Jitter', url: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/' },
  stripeRate: { title: 'Stripe: Scaling your API with rate limiters', url: 'https://stripe.com/blog/rate-limiters' },
  stripeIdem: { title: 'Stripe: Designing robust APIs with idempotency', url: 'https://stripe.com/blog/idempotency' },
  fbMemcache: { title: 'Paper: Scaling Memcache at Facebook', url: 'https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala' },
  discord: { title: 'Discord: How Discord stores trillions of messages', url: 'https://discord.com/blog/how-discord-stores-trillions-of-messages' },
  resilience4j: { title: 'Resilience4j (Java)', url: 'https://resilience4j.readme.io/' },
  tenacity: { title: 'Tenacity (Python retries)', url: 'https://tenacity.readthedocs.io/' },
}

export const ALL_RESOURCES = [
  { title: 'donnemartin/system-design-primer', url: PRIMER, desc: 'Fundamentos y conceptos núcleo. La referencia clásica con diagramas y ejercicios de entrevista.', best: 'Fundamentos' },
  { ...R.grokking, desc: 'Preparación basada en patrones (compañero de Grokking the System Design Interview).', best: 'Patrones de entrevista' },
  { ...R.karan, desc: 'Lectura estructurada estilo curso, de lo básico a casos de estudio.', best: 'Curso estructurado' },
  { ...R.ashish, desc: 'Lista moderna curada de conceptos, problemas y artículos de blogs de ingeniería.', best: 'Conceptos y problemas' },
  { ...R.scalability, desc: 'Casos reales de escalabilidad de empresas (Netflix, Uber, Discord...).', best: 'Casos reales' },
  { ...R.madd, desc: 'Lista amplia de recursos de sistemas distribuidos.', best: 'Sistemas distribuidos' },
  { ...R.ddia, desc: 'El libro de Martin Kleppmann: la base teórica de replicación, particionado y consistencia.', best: 'Profundidad' },
]
