import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { TOPICS } from '@/data/topics'
import type { CloudMapping } from '@/data/types'
import { useGame, type Cloud } from '@/store/game'
import { Card, SectionTitle, Segmented } from '@/components/ui'

const EXTRA: (CloudMapping & { group: string })[] = [
  { group: 'Plataforma', concept: 'Infraestructura como código', aws: 'CloudFormation / CDK', azure: 'Bicep / ARM', gcp: 'Infrastructure Manager (Terraform)', note: 'Terraform/OpenTofu y Pulumi funcionan en las tres' },
  { group: 'Plataforma', concept: 'Identidad y permisos', aws: 'IAM / IAM Identity Center', azure: 'Microsoft Entra ID + RBAC', gcp: 'Cloud IAM' },
  { group: 'Plataforma', concept: 'Secretos', aws: 'Secrets Manager / SSM Parameter Store', azure: 'Key Vault', gcp: 'Secret Manager' },
  { group: 'Plataforma', concept: 'Registro de contenedores', aws: 'ECR', azure: 'Azure Container Registry', gcp: 'Artifact Registry' },
  { group: 'Plataforma', concept: 'CI/CD', aws: 'CodePipeline / CodeBuild', azure: 'Azure DevOps Pipelines', gcp: 'Cloud Build / Cloud Deploy', note: 'GitHub Actions es muy común con cualquiera' },
  { group: 'Observabilidad', concept: 'Logs', aws: 'CloudWatch Logs', azure: 'Log Analytics', gcp: 'Cloud Logging' },
  { group: 'Observabilidad', concept: 'Trazas distribuidas', aws: 'X-Ray / CloudWatch Application Signals', azure: 'Application Insights', gcp: 'Cloud Trace', note: 'Instrumenta con OpenTelemetry para ser portable' },
  { group: 'Datos', concept: 'Object storage', aws: 'S3', azure: 'Blob Storage', gcp: 'Cloud Storage' },
  { group: 'Datos', concept: 'Data warehouse', aws: 'Redshift / Athena', azure: 'Synapse / Fabric', gcp: 'BigQuery' },
  { group: 'Datos', concept: 'CDC (change data capture)', aws: 'DMS', azure: 'Data Factory / Debezium en Event Hubs', gcp: 'Datastream' },
  { group: 'Datos', concept: 'Stream processing', aws: 'Managed Service for Apache Flink', azure: 'Stream Analytics', gcp: 'Dataflow (Apache Beam)' },
  { group: 'IA', concept: 'LLMs gestionados', aws: 'Bedrock', azure: 'Azure AI Foundry', gcp: 'Vertex AI', note: 'Diseño típico: API → caché semántica → LLM + base vectorial (RAG)' },
  { group: 'IA', concept: 'Base vectorial', aws: 'OpenSearch k-NN / Aurora pgvector / S3 Vectors', azure: 'AI Search vector / Cosmos DB vector', gcp: 'Vertex AI Vector Search / AlloyDB pgvector' },
]

export default function CloudPage() {
  const pref = useGame((s) => s.settings.cloud)
  const setSettings = useGame((s) => s.setSettings)
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const fromTopics = TOPICS.flatMap((t) => t.cloud.map((c) => ({ ...c, group: t.title })))
    const all = [...fromTopics, ...EXTRA]
    const needle = q.trim().toLowerCase()
    return needle ? all.filter((r) => [r.concept, r.aws, r.azure, r.gcp, r.group, r.note ?? ''].some((x) => x.toLowerCase().includes(needle))) : all
  }, [q])
  const groups = [...new Set(rows.map((r) => r.group))]
  const cols: { id: Cloud; label: string }[] = [
    { id: 'aws', label: 'AWS' },
    { id: 'azure', label: 'Azure' },
    { id: 'gcp', label: 'GCP' },
  ]

  return (
    <div className="grid gap-5">
      <SectionTitle sub="El mismo concepto con nombres distintos en cada nube. En una entrevista, nombrar el servicio gestionado correcto demuestra experiencia real.">☁️ Cloud Rosetta</SectionTitle>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: cola, Redis, DynamoDB, CDN…" className="w-full rounded-xl bg-surface border border-border pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent" />
        </div>
        <Segmented value={pref} onChange={(v) => setSettings({ cloud: v })} options={cols.map((c) => ({ id: c.id, label: `★ ${c.label}` }))} />
      </div>
      {groups.map((g) => (
        <div key={g}>
          <div className="text-xs font-bold uppercase tracking-wide text-muted mb-2">{g}</div>
          {/* Tabla en escritorio */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm table-fixed">
              <tbody>
                {rows
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <tr key={r.concept} className="border-t border-border first:border-0">
                      <td className="px-3 py-2 font-semibold w-1/4 align-top">
                        {r.concept}
                        {r.note && <div className="text-[11px] text-muted font-normal">{r.note}</div>}
                      </td>
                      {cols.map((c) => (
                        <td key={c.id} className={`px-3 py-2 align-top ${pref === c.id ? 'bg-accent/10 text-text font-medium' : 'text-muted'}`}>
                          {r[c.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {/* Tarjetas en móvil */}
          <div className="md:hidden grid gap-2">
            {rows
              .filter((r) => r.group === g)
              .map((r) => (
                <Card key={r.concept} className="p-3">
                  <div className="font-semibold text-sm mb-1">{r.concept}</div>
                  {cols.map((c) => (
                    <div key={c.id} className={`text-xs flex gap-2 ${pref === c.id ? 'text-text' : 'text-muted'}`}>
                      <span className={`w-12 shrink-0 font-bold ${pref === c.id ? 'text-accent' : ''}`}>{c.label}</span>
                      <span>{r[c.id]}</span>
                    </div>
                  ))}
                  {r.note && <div className="text-[11px] text-muted mt-1">💬 {r.note}</div>}
                </Card>
              ))}
          </div>
        </div>
      ))}
      {!rows.length && <div className="text-muted text-sm">Sin resultados.</div>}
    </div>
  )
}
