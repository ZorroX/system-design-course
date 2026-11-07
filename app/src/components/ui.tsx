import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`card ${onClick ? 'cursor-pointer hover:border-accent/60 transition-colors' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{children}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function ProgressBar({ value, color = 'var(--accent)', height = 8, className = '' }: { value: number; color?: string; height?: number; className?: string }) {
  return (
    <div className={`w-full rounded-full bg-surface-2 overflow-hidden ${className}`} style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 18 }}
      />
    </div>
  )
}

export function Ring({ value, size = 64, stroke = 7, color = 'var(--accent)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{children}</div>
    </div>
  )
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 border border-border px-3 py-2 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted font-semibold truncate">{label}</div>
      <div className="text-lg font-bold tabular-nums truncate" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted truncate">{sub}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`relative shrink-0 px-3 py-2.5 text-sm font-semibold transition-colors ${value === t.id ? 'text-text' : 'text-muted hover:text-text'}`}
        >
          {t.label}
          {value === t.id && <motion.div layoutId="tab-underline" className="absolute left-2 right-2 -bottom-px h-0.5 rounded bg-accent" />}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-surface-2 border border-border p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`relative rounded-lg font-semibold transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${value === o.id ? 'text-[#04131a]' : 'text-muted hover:text-text'}`}
        >
          {value === o.id && <motion.span layoutId={`seg-${options.map((x) => x.id).join('')}`} className="absolute inset-0 rounded-lg bg-accent" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="block">
      <div className="flex justify-between text-xs font-semibold text-muted mb-1">
        <span>{label}</span>
        <span className="text-text tabular-nums">{format ? format(value) : value}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function ChallengeBanner({ title, done, children }: { title: string; done: boolean; children: ReactNode }) {
  return (
    <motion.div
      layout
      className={`rounded-xl border px-4 py-3 text-sm flex gap-3 items-start ${done ? 'border-good/50 bg-good/10' : 'border-warn/40 bg-warn/5'}`}
    >
      <span className="text-xl leading-none">{done ? '✅' : '🎯'}</span>
      <div>
        <div className="font-bold">{done ? '¡Reto superado!' : `Reto: ${title}`}</div>
        <div className="text-muted">{children}</div>
      </div>
    </motion.div>
  )
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-5xl mb-3">{icon}</div>
      <div className="font-bold text-lg">{title}</div>
      {children && <div className="text-muted text-sm mt-1">{children}</div>}
    </div>
  )
}

export function Loading() {
  return (
    <div className="py-24 flex justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  )
}
