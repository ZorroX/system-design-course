export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string // emoji
  xp: number
  tier: 'bronze' | 'silver' | 'gold'
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-lesson', name: 'Hola, mundo distribuido', desc: 'Lee tu primera lección', icon: '📘', xp: 20, tier: 'bronze' },
  { id: 'first-sim', name: 'Manos en la consola', desc: 'Supera el reto de un simulador', icon: '🕹️', xp: 30, tier: 'bronze' },
  { id: 'all-sims', name: 'Ingeniero de laboratorio', desc: 'Supera todos los simuladores', icon: '🧪', xp: 200, tier: 'gold' },
  { id: 'perfect-quiz', name: 'Sin errores', desc: 'Saca 100% en un quiz', icon: '🎯', xp: 40, tier: 'silver' },
  { id: 'topics-5', name: 'Cimientos sólidos', desc: 'Completa 5 temas', icon: '🧱', xp: 80, tier: 'silver' },
  { id: 'topics-all', name: 'Arquitecto', desc: 'Completa todos los temas', icon: '🏛️', xp: 300, tier: 'gold' },
  { id: 'streak-3', name: 'En llamas', desc: 'Racha de 3 días', icon: '🔥', xp: 30, tier: 'bronze' },
  { id: 'streak-7', name: 'Alta disponibilidad', desc: 'Racha de 7 días (99.9% uptime personal)', icon: '⚡', xp: 100, tier: 'gold' },
  { id: 'first-design', name: 'Primer diagrama', desc: 'Consigue al menos 1★ en el Design Lab', icon: '🗺️', xp: 40, tier: 'bronze' },
  { id: 'three-stars', name: 'Diseño impecable', desc: 'Consigue 3★ en un reto del Design Lab', icon: '🌟', xp: 80, tier: 'silver' },
  { id: 'all-designs', name: 'Principal Engineer', desc: '2★ o más en todos los retos del Design Lab', icon: '👑', xp: 300, tier: 'gold' },
  { id: 'chaos', name: 'Domador del caos', desc: 'Tu diseño sobrevive al Chaos Monkey', icon: '🐒', xp: 60, tier: 'silver' },
  { id: 'estimator', name: 'Servilleta maestra', desc: '5 estimaciones con 70+ puntos', icon: '🧮', xp: 60, tier: 'silver' },
  { id: 'first-interview', name: 'En la silla caliente', desc: 'Completa una entrevista simulada', icon: '🎤', xp: 50, tier: 'bronze' },
  { id: 'interview-ace', name: 'Oferta recibida', desc: 'Entrevista simulada con 80%+', icon: '💼', xp: 150, tier: 'gold' },
  { id: 'cards-50', name: 'Memoria persistente', desc: '50 repasos de flashcards', icon: '🧠', xp: 60, tier: 'silver' },
  { id: 'polyglot', name: 'Políglota', desc: 'Explora código en Java y en Python', icon: '☕', xp: 20, tier: 'bronze' },
  { id: 'scholar', name: 'Ratón de biblioteca', desc: 'Lee 3 artículos del glosario', icon: '📚', xp: 30, tier: 'bronze' },
  { id: 'encyclopedia', name: 'Enciclopedia andante', desc: 'Lee todos los artículos del glosario', icon: '🎓', xp: 150, tier: 'gold' },
  { id: 'quest-begin', name: 'Aprendiz de Arquitecto', desc: 'Comienza la aventura NIMBUS', icon: '🗡️', xp: 20, tier: 'bronze' },
  { id: 'quest-pillar', name: 'Primera luz', desc: 'Restaura tu primer pilar en NIMBUS', icon: '🕯️', xp: 40, tier: 'bronze' },
  { id: 'quest-five', name: 'Los cinco pilares', desc: 'Restaura los 5 pilares de NIMBUS', icon: '🏛️', xp: 150, tier: 'silver' },
  { id: 'quest-hero', name: 'Héroe del Viernes Negro', desc: 'Derrota a la Horda en la Ciudadela del Pico', icon: '🐉', xp: 300, tier: 'gold' },
  { id: 'quest-scrolls', name: 'Coleccionista de saberes', desc: 'Encuentra los 8 pergaminos de NIMBUS', icon: '📜', xp: 80, tier: 'silver' },
  { id: 'quest-treasury', name: 'Guardián del Tesoro', desc: 'Rompe los 6 sellos del Distrito del Tesoro en NIMBUS', icon: '🏦', xp: 200, tier: 'gold' },
  { id: 'star-stories', name: 'Narrador STAR', desc: 'Escribe 3 historias STAR completas para la entrevista', icon: '🎙️', xp: 60, tier: 'silver' },
  { id: 'xp-1000', name: 'Mil peticiones', desc: 'Alcanza 1.000 XP', icon: '📈', xp: 0, tier: 'silver' },
  { id: 'xp-5000', name: 'Escala web', desc: 'Alcanza 5.000 XP', icon: '🚀', xp: 0, tier: 'gold' },
]
