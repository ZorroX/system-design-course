import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { useMemo } from 'react'
import { DOMAINS, TOPICS } from '@/data/topics'
import { topicScore, useGame } from '@/store/game'
import { useColors } from '@/lib/hooks'
import { dayKey } from '@/lib/format'

export function useDomainMastery() {
  const topics = useGame((s) => s.topics)
  return useMemo(
    () =>
      Object.values(DOMAINS).map((d) => {
        const ts = TOPICS.filter((t) => t.domain === d.id)
        const v = ts.length ? ts.reduce((acc, t) => acc + topicScore(topics[t.id]), 0) / ts.length : 0
        return { domain: d.name, value: Math.round(v), id: d.id }
      }),
    [topics],
  )
}

export function SkillRadar({ height = 260 }: { height?: number }) {
  const data = useDomainMastery()
  const c = useColors()
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={c.border} />
          <PolarAngleAxis dataKey="domain" tick={{ fill: c.muted, fontSize: 11 }} />
          <Radar dataKey="value" stroke={c.accent} fill={c.accent} fillOpacity={0.3} strokeWidth={2} isAnimationActive />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Heatmap({ weeks = 16 }: { weeks?: number }) {
  const activity = useGame((s) => s.activity)
  const goal = useGame((s) => s.settings.dailyGoal)
  const days = useMemo(() => {
    const out: { key: string; xp: number; future: boolean }[] = []
    const today = new Date()
    const start = new Date(today)
    const weekday = (today.getDay() + 6) % 7 // lunes = 0
    start.setDate(today.getDate() - weekday - (weeks - 1) * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + weeks * 7)
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d)
      out.push({ key, xp: activity[key] ?? 0, future: d > today })
    }
    return out
  }, [activity, weeks])
  const level = (xp: number) => (xp === 0 ? 0 : xp < goal * 0.5 ? 1 : xp < goal ? 2 : xp < goal * 2 ? 3 : 4)
  const shades = ['var(--surface-2)', 'color-mix(in srgb, var(--good) 30%, transparent)', 'color-mix(in srgb, var(--good) 55%, transparent)', 'color-mix(in srgb, var(--good) 80%, transparent)', 'var(--good)']
  return (
    <div className="overflow-x-auto scrollbar-none">
      <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 12px)', width: 'max-content' }}>
        {days.map((d) => (
          <div key={d.key} title={`${d.key}: ${d.xp} XP`} className="w-3 h-3 rounded-[3px]" style={{ background: d.future ? 'transparent' : shades[level(d.xp)] }} />
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-muted">
        menos {shades.map((s, i) => <span key={i} className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: s }} />)} más · meta diaria {goal} XP
      </div>
    </div>
  )
}
