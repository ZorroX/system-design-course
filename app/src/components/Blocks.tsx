import { useMemo } from 'react'
import type { Block } from '@/data/types'
import { Rich } from './Rich'
import { Widget } from './widgets'
import { CodeBlock } from './CodeBlock'
import { linkify } from '@/lib/glossary-link'
import { useGame } from '@/store/game'

/** Enlaza la primera mención de cada término del glosario en toda la lección (orden de lectura). */
function linkBlocks(blocks: Block[], exclude: string[]): Block[] {
  const seen = new Set(exclude)
  const L = (t: string) => linkify(t, seen)
  return blocks.map((b): Block => {
    switch (b.type) {
      case 'p':
        return { ...b, text: L(b.text) }
      case 'list':
        return { ...b, items: b.items.map(L) }
      case 'callout':
        return { ...b, text: L(b.text) }
      case 'table':
        return { ...b, rows: b.rows.map((r) => r.map((c, k) => (k === 0 ? c : L(c)))) }
      case 'tradeoff':
        return { ...b, left: { ...b.left, items: b.left.items.map(L) }, right: { ...b.right, items: b.right.items.map(L) } }
      default:
        return b
    }
  })
}

const TONE: Record<string, { cls: string; icon: string; label: string }> = {
  info: { cls: 'border-accent/40 bg-accent/5', icon: 'ℹ️', label: 'Dato' },
  tip: { cls: 'border-good/40 bg-good/5', icon: '💡', label: 'Tip' },
  warn: { cls: 'border-warn/40 bg-warn/5', icon: '⚠️', label: 'Cuidado' },
  interview: { cls: 'border-violet/50 bg-violet/10', icon: '🎤', label: 'En la entrevista' },
}

const NONE: string[] = []

export function Blocks({ blocks: raw, exclude = NONE }: { blocks: Block[]; exclude?: string[] }) {
  const autoTerms = useGame((s) => s.settings.autoTerms)
  const blocks = useMemo(() => (autoTerms ? linkBlocks(raw, exclude) : raw), [raw, autoTerms, exclude])
  return (
    <div className="prose-sd text-[15px] text-text/90">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p':
            return (
              <p key={i}>
                <Rich text={b.text} />
              </p>
            )
          case 'h':
            return (
              <h3 key={i} className="text-lg font-bold mt-7 mb-2 text-text">
                {b.text}
              </h3>
            )
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul'
            return (
              <Tag key={i} className={`my-3 pl-5 space-y-1.5 ${b.ordered ? 'list-decimal' : 'list-disc'} marker:text-accent`}>
                {b.items.map((it, j) => (
                  <li key={j} className="leading-relaxed pl-1">
                    <Rich text={it} />
                  </li>
                ))}
              </Tag>
            )
          }
          case 'callout': {
            const t = TONE[b.tone]
            return (
              <div key={i} className={`my-4 rounded-xl border px-4 py-3 ${t.cls}`}>
                <div className="text-xs font-bold uppercase tracking-wide mb-1">
                  {t.icon} {b.title ?? t.label}
                </div>
                <div className="text-sm leading-relaxed">
                  <Rich text={b.text} />
                </div>
              </div>
            )
          }
          case 'table':
            return (
              <div key={i} className="my-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2">
                    <tr>
                      {b.head.map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-t border-border">
                        {r.map((c, k) => (
                          <td key={k} className={`px-3 py-2 align-top ${k === 0 ? 'font-semibold whitespace-nowrap' : 'text-muted'}`}>
                            <Rich text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'tradeoff':
            return (
              <div key={i} className="my-4 grid sm:grid-cols-2 gap-3">
                {[b.left, b.right].map((side, j) => (
                  <div key={j} className={`rounded-xl border p-4 ${j === 0 ? 'border-violet/40 bg-violet/5' : 'border-good/40 bg-good/5'}`}>
                    <div className="font-bold mb-2">{side.title}</div>
                    <ul className="space-y-1 text-sm">
                      {side.items.map((it, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="text-muted">•</span>
                          <span>
                            <Rich text={it} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          case 'widget':
            return <Widget key={i} id={b.id} />
          case 'code':
            return (
              <div key={i} className="grid gap-1">
                {b.title && <div className="text-xs font-bold text-muted">{b.title}</div>}
                <CodeBlock code={b.code} language={b.lang} maxHeight={420} />
              </div>
            )
        }
      })}
    </div>
  )
}
