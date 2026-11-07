import { Fragment, useMemo } from 'react'
import { Term } from './Term'
import { linkify } from '@/lib/glossary-link'
import { useGame } from '@/store/game'

/**
 * Formato inline mínimo: **negrita**, *cursiva*, `código` y [[termino]] / [[termino|texto]] (tooltip del glosario).
 * Con `auto`, además enlaza automáticamente la primera mención de cada término del glosario.
 */
export function Rich({ text, auto = false }: { text: string; auto?: boolean }) {
  const autoTerms = useGame((s) => s.settings.autoTerms)
  const src = useMemo(() => (auto && autoTerms ? linkify(text) : text), [text, auto, autoTerms])
  return <Parsed text={src} />
}

function Parsed({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[\[[^\]]+\]\])/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4)
          return (
            <strong key={i} className="font-semibold text-text">
              <Parsed text={p.slice(2, -2)} />
            </strong>
          )
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2)
          return (
            <em key={i} className="italic">
              <Parsed text={p.slice(1, -1)} />
            </em>
          )
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>
        if (p.startsWith('[[') && p.endsWith(']]')) {
          const [id, label] = p.slice(2, -2).split('|')
          return (
            <Term key={i} id={id}>
              {label ?? undefined}
            </Term>
          )
        }
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}

/** Exportado para pre-procesar varios bloques compartiendo el set de términos ya vistos. */
export { Parsed as RichParsed }
