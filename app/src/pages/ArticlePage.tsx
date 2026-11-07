import { motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, ExternalLink, GraduationCap } from 'lucide-react'
import { termById } from '@/data/glossary'
import { ARTICLES, type Article } from '@/data/articles'
import { topicById } from '@/data/topics'
import { useGame } from '@/store/game'
import { Blocks } from '@/components/Blocks'
import { CodeBlock } from '@/components/CodeBlock'
import { Card, Empty, Segmented } from '@/components/ui'
import { Rich } from '@/components/Rich'
import { Term } from '@/components/Term'

const KIND: Record<Article['links'][number]['kind'], string> = {
  docs: '📘 Documentación',
  paper: '📄 Paper',
  blog: '✍️ Blog',
  wiki: '🌐 Wikipedia',
  libro: '📚 Libro',
  video: '🎬 Visual',
}

function RelatedChips({ ids }: { ids: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((rid) => {
        const r = termById(rid)
        if (!r) return null
        return (
          <span key={rid} className="chip !text-sm !py-1">
            <Term id={rid}>{r.term}</Term>
          </span>
        )
      })}
    </div>
  )
}

export default function ArticlePage() {
  const { id = '' } = useParams()
  const t = termById(id)
  const a = ARTICLES[id]
  const read = useGame((s) => s.articlesRead.includes(id))
  const readArticle = useGame((s) => s.readArticle)
  const lang = useGame((s) => s.settings.lang)
  const setSettings = useGame((s) => s.setSettings)
  const end = useRef<HTMLDivElement>(null)
  const self = useMemo(() => [id], [id])

  // Se marca como leído al llegar al final del artículo
  useEffect(() => {
    if (!a || read || !end.current) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && readArticle(id), { threshold: 1 })
    io.observe(end.current)
    return () => io.disconnect()
  }, [a, read, id, readArticle])

  if (!t) return <Empty icon="📖" title="Término no encontrado" />
  const topic = t.topic ? topicById(t.topic) : undefined
  const seeArticle = !a && t.see && ARTICLES[t.see] ? termById(t.see) : undefined

  return (
    <div className="max-w-3xl">
      <Link to="/glossary" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4">
        <ArrowLeft size={16} /> Glosario
      </Link>

      <motion.header key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="chip !text-accent !border-accent/40">{t.cat}</span>
          {a && <span className="chip">⏱ {a.minutes} min</span>}
          {read && <span className="chip !text-good !border-good/40">✓ Leído</span>}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.term}</h1>
        <Card className="mt-4 p-4 border-accent/30 bg-accent/5">
          <div className="text-xs font-bold uppercase tracking-wide text-accent mb-1">💡 En una frase</div>
          <div className="text-[15px] leading-relaxed prose-sd">
            <Rich text={a ? a.lead : t.short} />
          </div>
        </Card>
      </motion.header>

      {a ? (
        <>
          <Blocks blocks={a.blocks} exclude={self} />

          {a.code && (
            <div className="mt-8 grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-bold">💻 {a.code.title}</div>
                <Segmented size="sm" value={lang} onChange={(l) => setSettings({ lang: l })} options={[{ id: 'java', label: '☕ Java' }, { id: 'python', label: '🐍 Python' }]} />
              </div>
              <CodeBlock code={lang === 'java' ? a.code.java : a.code.python} language={lang} maxHeight={420} />
            </div>
          )}

          <Card className="mt-8 p-5">
            <div className="font-bold mb-3">📚 Bibliografía y para saber más</div>
            <div className="grid gap-2">
              {a.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="group flex items-start gap-3 rounded-lg px-3 py-2 border border-border hover:border-accent/60 transition-colors">
                  <ExternalLink size={15} className="mt-0.5 text-muted group-hover:text-accent shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold group-hover:text-accent">{l.title}</span>
                    <span className="block text-[11px] text-muted">
                      {KIND[l.kind]} · {l.lang === 'es' ? 'Español' : 'Inglés'} · {new URL(l.url).hostname.replace('www.', '')}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-5 text-sm text-muted">
          Este término no tiene artículo propio.
          {seeArticle && (
            <>
              {' '}Lo explicamos dentro de{' '}
              <Link to={`/glossary/${seeArticle.id}`} className="text-accent hover:underline">
                {seeArticle.term}
              </Link>
              .
            </>
          )}
        </Card>
      )}

      <div className="mt-6 grid gap-4">
        {(a?.related.length ?? 0) > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Términos relacionados</div>
            <RelatedChips ids={a!.related} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {topic && (
            <Link to={`/topic/${topic.id}`} className="btn btn-ghost">
              <GraduationCap size={16} /> Ver el tema: {topic.title}
            </Link>
          )}
          {seeArticle && (
            <Link to={`/glossary/${seeArticle.id}`} className="btn btn-primary">
              <BookOpen size={16} /> Leer: {seeArticle.term}
            </Link>
          )}
        </div>
      </div>

      <div ref={end} className="h-6 mt-6 text-center text-xs text-muted">
        {a && (read ? '✓ Artículo completado' : 'Llegaste al final: +10 XP')}
      </div>
    </div>
  )
}
