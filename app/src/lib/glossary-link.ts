import { GLOSSARY } from '@/data/glossary'

/**
 * Convierte menciones de términos del glosario en marcado `[[id|texto]]`.
 * - Respeta segmentos de `código` y enlaces [[...]] ya existentes.
 * - Solo enlaza la PRIMERA aparición de cada término dentro de `seen` (estilo Wikipedia).
 * - Siglas en mayúsculas (CAP, TTL, DNS...) se comparan respetando mayúsculas para evitar falsos positivos.
 */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const entries = GLOSSARY.flatMap((t) => t.aliases.map((a) => ({ alias: a, id: t.id }))).sort((a, b) => b.alias.length - a.alias.length)
const isAcronym = (a: string) => a.length <= 5 && a === a.toUpperCase() && /[A-Z]/.test(a)

const B = '(?<![\\p{L}\\p{N}_/-])'
const A = '(?![\\p{L}\\p{N}_-])'
const ciAliases = entries.filter((e) => !isAcronym(e.alias))
const csAliases = entries.filter((e) => isAcronym(e.alias))
const reCI = new RegExp(`${B}(${ciAliases.map((e) => escape(e.alias)).join('|')})${A}`, 'giu')
const reCS = new RegExp(`${B}(${csAliases.map((e) => escape(e.alias)).join('|')})${A}`, 'gu')

const byAlias = new Map<string, string>()
for (const e of ciAliases) if (!byAlias.has(e.alias.toLowerCase())) byAlias.set(e.alias.toLowerCase(), e.id)
const byAcronym = new Map(csAliases.map((e) => [e.alias, e.id]))

function linkPlain(text: string, seen: Set<string>): string {
  // Encuentra todas las coincidencias (ambas regex), resuelve solapes por posición y longitud
  const hits: { start: number; end: number; id: string; match: string }[] = []
  for (const m of text.matchAll(reCI)) {
    const id = byAlias.get(m[1].toLowerCase())
    if (id) hits.push({ start: m.index!, end: m.index! + m[1].length, id, match: m[1] })
  }
  for (const m of text.matchAll(reCS)) {
    const id = byAcronym.get(m[1])
    if (id) hits.push({ start: m.index!, end: m.index! + m[1].length, id, match: m[1] })
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  let out = ''
  let pos = 0
  for (const h of hits) {
    if (h.start < pos || seen.has(h.id)) continue
    seen.add(h.id)
    out += text.slice(pos, h.start) + `[[${h.id}|${h.match}]]`
    pos = h.end
  }
  return out + text.slice(pos)
}

export function linkify(text: string, seen: Set<string> = new Set()): string {
  // No tocar `código` ni enlaces [[...]] existentes (pero marcar estos últimos como vistos)
  return text
    .split(/(`[^`]+`|\[\[[^\]]+\]\])/g)
    .map((part) => {
      if (part.startsWith('`')) return part
      if (part.startsWith('[[')) {
        seen.add(part.slice(2, -2).split('|')[0])
        return part
      }
      return linkPlain(part, seen)
    })
    .join('')
}
