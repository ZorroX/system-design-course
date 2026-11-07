import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useState } from 'react'
import { CASES } from '@/data/cases'
import { useGame } from '@/store/game'
import { Card, SectionTitle } from '@/components/ui'
import { Rich } from '@/components/Rich'

const FRAMEWORK = [
  { step: 'Requisitos', min: 5, text: 'Funcionales (qué hace) y no funcionales (escala, latencia, disponibilidad, consistencia). Pregunta, no asumas.' },
  { step: 'Estimación', min: 5, text: 'DAU → QPS (promedio y pico) → almacenamiento → ancho de banda. Redondea y usa el resultado.' },
  { step: 'API', min: 5, text: 'Endpoints principales con parámetros y respuestas. Idempotencia y paginación.' },
  { step: 'Modelo de datos', min: 5, text: 'Entidades, claves de acceso y qué almacenamiento para cada una (y por qué).' },
  { step: 'Alto nivel', min: 10, text: 'Diagrama de cajas: cliente → LB → servicios → caché/colas → datos. Recorre un flujo de lectura y uno de escritura.' },
  { step: 'Deep dive', min: 10, text: 'Profundiza en 1–2 componentes críticos: el algoritmo, la partición, la consistencia.' },
  { step: 'Cierre', min: 5, text: 'Cuellos de botella, fallos, monitoreo, trade-offs y qué harías con más tiempo.' },
]

export default function InterviewList() {
  const interviews = useGame((s) => s.interviews)
  const [openStep, setOpenStep] = useState<number | null>(0)
  return (
    <div className="grid gap-6">
      <SectionTitle sub="Casos clásicos de entrevista resueltos paso a paso, con arquitectura, trade-offs, preguntas de seguimiento y equivalentes en AWS/Azure/GCP.">🎤 Preparación de entrevistas</SectionTitle>

      <Card className="p-5">
        <div className="font-bold mb-1">El framework de 45 minutos</div>
        <p className="text-sm text-muted mb-4">Úsalo siempre en el mismo orden. Las entrevistas simuladas te cronometran cada fase.</p>
        <div className="grid sm:grid-cols-7 gap-2">
          {FRAMEWORK.map((f, i) => (
            <button key={f.step} onClick={() => setOpenStep(i)} className={`rounded-xl border p-2 text-left transition-colors ${openStep === i ? 'border-violet bg-violet/10' : 'border-border bg-surface-2 hover:border-violet/50'}`}>
              <div className="text-[10px] text-muted font-mono">
                {i + 1} · {f.min} min
              </div>
              <div className="text-xs font-bold">{f.step}</div>
            </button>
          ))}
        </div>
        {openStep !== null && (
          <motion.div key={openStep} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm mt-3 text-muted">
            <Rich text={`**${FRAMEWORK[openStep].step}:** ${FRAMEWORK[openStep].text}`} />
          </motion.div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CASES.map((c, i) => {
          const best = Math.max(0, ...interviews.filter((x) => x.caseId === c.id).map((x) => x.score))
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/interview/${c.id}`} className="card p-5 block h-full hover:border-violet/60 transition-colors group">
                <div className="flex items-start justify-between">
                  <span className="text-4xl group-hover:scale-110 transition-transform">{c.emoji}</span>
                  <span className="chip">{'🔥'.repeat(c.difficulty)}</span>
                </div>
                <div className="font-bold mt-3">{c.title}</div>
                <div className="text-xs text-muted">Inspirado en {c.inspiredBy}</div>
                <p className="text-sm text-muted mt-2 line-clamp-2">{c.prompt}</p>
                {best > 0 && <div className="text-xs mt-3 text-good">Mejor entrevista: {best}%</div>}
              </Link>
            </motion.div>
          )
        })}
      </div>

      {interviews.length > 0 && (
        <Card className="p-5">
          <div className="font-bold mb-3">Historial de entrevistas simuladas</div>
          <div className="grid gap-2">
            {interviews.slice(0, 10).map((r) => {
              const c = CASES.find((x) => x.id === r.caseId)
              return (
                <div key={r.id} className="flex items-center gap-3 text-sm">
                  <span>{c?.emoji}</span>
                  <span className="flex-1 truncate">{c?.title}</span>
                  <span className="text-xs text-muted">{new Date(r.date).toLocaleDateString()}</span>
                  <span className="text-xs text-muted">{r.minutes} min</span>
                  <span className={`font-bold tabular-nums ${r.score >= 80 ? 'text-good' : r.score >= 60 ? 'text-warn' : 'text-bad'}`}>{r.score}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

export { FRAMEWORK }
