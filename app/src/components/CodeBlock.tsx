import { Highlight, themes } from 'prism-react-renderer'
import '@/lib/prism'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useGame } from '@/store/game'

export function CodeBlock({ code, language, maxHeight = 520 }: { code: string; language: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false)
  const theme = useGame((s) => s.settings.theme)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard no disponible */
    }
  }
  return (
    <div className="relative rounded-xl border border-border overflow-hidden" style={{ background: theme === 'dark' ? '#0a0f1f' : '#f8fafc' }}>
      <button onClick={copy} className="absolute top-2 right-2 z-10 btn btn-ghost !px-2 !py-1 text-xs" aria-label="Copiar código">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <Highlight code={code.trimEnd()} language={language} theme={theme === 'dark' ? themes.nightOwl : themes.github}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="overflow-auto text-[12.5px] leading-relaxed font-mono p-4 pt-10" style={{ maxHeight, background: 'transparent' }}>
            {tokens.map((line, i) => {
              const { key: _k, ...lineProps } = getLineProps({ line, key: i }) as Record<string, unknown>
              void _k
              return (
                <div key={i} {...lineProps} className="table-row">
                  <span className="table-cell pr-4 text-right select-none text-muted/50 tabular-nums">{i + 1}</span>
                  <span className="table-cell">
                    {line.map((token, k) => {
                      const { key: _tk, ...tokenProps } = getTokenProps({ token, key: k }) as Record<string, unknown>
                      void _tk
                      return <span key={k} {...tokenProps} />
                    })}
                  </span>
                </div>
              )
            })}
          </pre>
        )}
      </Highlight>
    </div>
  )
}
