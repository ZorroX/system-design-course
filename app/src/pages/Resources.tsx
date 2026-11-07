import { ExternalLink, Terminal } from 'lucide-react'
import { ALL_RESOURCES } from '@/data/resources'
import { TOPICS } from '@/data/topics'
import { Card, SectionTitle } from '@/components/ui'

export default function Resources() {
  const labs = TOPICS.filter((t) => t.code)
  return (
    <div className="grid gap-6">
      <SectionTitle sub="Las fuentes en las que se basa este curso, para ir más profundo.">📚 Recursos</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-4">
        {ALL_RESOURCES.map((r) => (
          <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="card p-5 hover:border-accent/60 transition-colors block">
            <div className="flex items-start justify-between gap-3">
              <div className="font-bold font-mono text-sm break-all">{r.title}</div>
              <ExternalLink size={16} className="text-muted shrink-0" />
            </div>
            <div className="chip mt-2">{r.best}</div>
            <p className="text-sm text-muted mt-2">{r.desc}</p>
          </a>
        ))}
      </div>

      <Card className="p-5">
        <div className="font-bold mb-1 flex items-center gap-2">
          <Terminal size={18} className="text-accent" /> Labs de código para correr en local
        </div>
        <p className="text-sm text-muted mb-4">Todo el código que ves en la pestaña "Código" de cada tema vive en la carpeta <code className="font-mono">labs/</code> del repositorio y se ejecuta sin dependencias externas (Java 17+ con single-file source launch, Python 3.10+ solo con la librería estándar).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted">
                <th className="py-1 pr-3">Tema</th>
                <th className="py-1 pr-3">Java</th>
                <th className="py-1">Python</th>
              </tr>
            </thead>
            <tbody>
              {labs.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {t.icon} {t.title}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">{t.code!.runJava}</td>
                  <td className="py-2 font-mono text-xs whitespace-nowrap">{t.code!.runPython}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
