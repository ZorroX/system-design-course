/**
 * El Consejo de los Sabios — entrevista C-level: método STAR (nivel 1) y respuestas
 * ejecutivas: concisas, honestas y conectadas con el negocio, parte en inglés (nivel 2).
 */

export type StarPart = 'S' | 'T' | 'A' | 'R'
export const STAR_LABEL: Record<StarPart, string> = { S: 'Situación', T: 'Tarea', A: 'Acción', R: 'Resultado' }

export interface StarStoryPuzzle {
  prompt: string
  parts: Record<StarPart, string>
  /** distractor: frase que NO debería estar (relleno, culpa o vaguedad) */
  noise: string
  noiseWhy: string
}

export const STAR_STORIES: StarStoryPuzzle[] = [
  {
    prompt: '"Cuéntanos de un incidente crítico en producción que hayas liderado."',
    parts: {
      S: 'Un viernes de quincena, la API de cobros empezó a duplicar cargos tras un timeout con el adquirente.',
      T: 'Como líder de guardia, debía frenar los duplicados y devolver el dinero en menos de una hora.',
      A: 'Desactivé los reintentos con un feature flag, añadí idempotency keys con hash del payload y conciliamos contra el archivo del adquirente.',
      R: 'Reembolsamos 312 cargos en 40 minutos, los duplicados bajaron a cero y el post-mortem sin culpables dejó 4 acciones que cerramos en 2 semanas.',
    },
    noise: 'El problema fue culpa del equipo de QA, que no probó bien.',
    noiseWhy: 'Un post-mortem maduro es sin culpables (blameless): se buscan fallos del sistema, no personas.',
  },
  {
    prompt: '"¿Cómo equilibras la deuda técnica con las funcionalidades que pide negocio?"',
    parts: {
      S: 'Nuestro monolito de pagos tardaba 3 horas en desplegarse y frenaba al equipo comercial.',
      T: 'Tenía que acelerar las entregas sin detener el roadmap del trimestre.',
      A: 'Creé un registro de deuda priorizado por impacto en el negocio y acordé con producto dedicar el 20% de cada sprint a pagarla.',
      R: 'En dos trimestres los despliegues bajaron a 15 minutos y entregamos un 30% más de funcionalidades.',
    },
    noise: 'Paramos todo el desarrollo seis meses para reescribir el sistema desde cero.',
    noiseWhy: 'La reescritura total ("big bang") rara vez es la respuesta: se paga deuda de forma continua y medible.',
  },
  {
    prompt: '"Háblanos de una migración de monolito a microservicios."',
    parts: {
      S: 'El módulo de conciliación del monolito fallaba cada fin de mes por la carga.',
      T: 'Me pidieron evaluar si migrar a microservicios y con qué riesgo.',
      A: 'Hice un análisis costo-beneficio, extraje solo conciliación con el patrón strangler fig detrás de un feature flag y migré el tráfico de forma gradual.',
      R: 'Los cierres de mes pasaron de 9 horas a 50 minutos, sin incidentes, y dejamos el resto en el monolito porque no justificaba el costo.',
    },
    noise: 'Migramos los 40 módulos a la vez porque los microservicios son el estándar moderno.',
    noiseWhy: 'Cada pieza de arquitectura debe justificarse con una necesidad real, no por moda.',
  },
]

export interface CouncilQ {
  who: string
  q: string
  options: string[]
  answer: number
  why: string
}

export const COUNCIL_QS: CouncilQ[] = [
  {
    who: 'Reina del Negocio',
    q: 'En una frase: ¿por qué invertir un trimestre en idempotencia y conciliación?',
    options: [
      'Porque es una buena práctica de arquitectura distribuida que recomiendan Stripe y AWS.',
      'Porque hoy perdemos ~0,3% de los cobros en duplicados y reembolsos; eliminarlo ahorra soporte, comisiones y protege la confianza de los comercios.',
      'Porque el equipo técnico lo pidió y está motivado.',
    ],
    answer: 1,
    why: 'Al panel ejecutivo se le habla en impacto: dinero, clientes y riesgo, con un número concreto.',
  },
  {
    who: 'Archimago Técnico',
    q: '¿Conoces a fondo el algoritmo de consenso Raft?',
    options: [
      'Sí, claro (y luego improvisar una explicación larga).',
      'No lo he implementado. Conozco la idea: líder elegido, réplica de log y mayoría para confirmar. Si lo necesitara, empezaría por el paper y etcd.',
      'Eso no es importante en la práctica.',
    ],
    answer: 1,
    why: 'Honestidad intelectual: reconocer el límite y mostrar tu método para aprender vale más que divagar.',
  },
  {
    who: 'Tesorero',
    q: 'El equipo quiere migrar todo el monolito a microservicios. ¿Qué haces?',
    options: [
      'Aprobarlo: es el estándar moderno.',
      'Pedir un análisis costo-beneficio, empezar por el dominio con más dolor medible (strangler fig) y decidir con datos si seguir.',
      'Rechazarlo: los monolitos siempre son mejores.',
    ],
    answer: 1,
    why: 'Decisiones incrementales, reversibles y justificadas con métricas, no por moda ni por dogma.',
  },
  {
    who: 'Archimago Técnico',
    q: 'Tell us about a production incident you caused. What did you learn?',
    options: [
      'I deployed a migration that locked the payments table for 4 minutes. I owned it in the post-mortem, and we added online schema migrations and canary releases. It has not happened again.',
      'I never caused incidents; usually other teams break things.',
      'It was a long time ago and it was complicated, many factors were involved, the database, the network, also the vendor…',
    ],
    answer: 0,
    why: 'Claro, breve y con aprendizaje concreto (STAR condensado). Asumir la responsabilidad y mostrar la salvaguarda que evitó la repetición.',
  },
  {
    who: 'Reina del Negocio',
    q: 'Producto exige 5 funcionalidades este trimestre y tú tienes deuda técnica que causa incidentes. ¿Cómo lo resuelves?',
    options: [
      'Hacer solo funcionalidades: negocio manda.',
      'Mostrar el costo de la deuda en incidentes y horas, priorizar juntos y reservar una capacidad fija (p. ej. 20%) para pagarla.',
      'Pagar toda la deuda primero y luego hacer funcionalidades.',
    ],
    answer: 1,
    why: 'La deuda técnica se gestiona como cualquier inversión: visible, cuantificada y con capacidad reservada y sostenible.',
  },
  {
    who: 'Tesorero',
    q: 'How would you work with the engineering team in China, with a 14-hour time difference?',
    options: [
      'I would ask them to join our daily meeting at 2 a.m. their time.',
      'Async-first: written design docs and ADRs, recorded demos, clear ownership, and a short overlap window a couple of times a week for decisions.',
      'Each team works alone; we only talk when something breaks.',
    ],
    answer: 1,
    why: 'Colaboración global: documentación escrita, decisiones registradas y una ventana de solapamiento corta y respetuosa.',
  },
  {
    who: 'Archimago Técnico',
    q: '¿Cómo cierras un post-mortem para que el incidente no se repita?',
    options: [
      'Identificando al responsable para que tenga más cuidado.',
      'Línea de tiempo, causa raíz con los 5 porqués, acciones con dueño y fecha (alertas, tests, salvaguardas automáticas) y seguimiento hasta cerrarlas.',
      'Enviando un correo pidiendo a todos que tengan más cuidado.',
    ],
    answer: 1,
    why: 'Blameless + acciones concretas, con dueño y fecha, que hagan imposible (o detectable) el mismo fallo.',
  },
]

export function starStars(errors: number) {
  return errors === 0 ? 3 : errors <= 2 ? 2 : errors <= 4 ? 1 : 0
}

export const COUNCIL_HEARTS = 3
export function councilStars(wrong: number) {
  return wrong === 0 ? 3 : wrong === 1 ? 2 : wrong === 2 ? 1 : 0
}
