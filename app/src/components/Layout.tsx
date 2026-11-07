import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { BookA, BookOpen, Brain, Gamepad2, Calculator, Cloud, Flame, Globe2, House, LayoutGrid, Map, Mic, Moon, Network, Sun, Target, Trophy } from 'lucide-react'
import { levelInfo, streakOf, useGame } from '@/store/game'
import { Loading, ProgressBar } from './ui'
import { Toasts } from './Toasts'
import { Suspense, useEffect } from 'react'

const NAV = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/map', label: 'Mapa de skills', icon: Map },
  { to: '/path', label: 'Ruta: entrevista Java', icon: Target },
  { to: '/quest', label: 'Aventura NIMBUS', icon: Gamepad2 },
  { to: '/lab', label: 'Design Lab', icon: Network },
  { to: '/interview', label: 'Entrevistas', icon: Mic },
  { to: '/estimate', label: 'Estimación', icon: Calculator },
  { to: '/review', label: 'Repaso', icon: Brain },
  { to: '/cloud', label: 'Cloud Rosetta', icon: Cloud },
  { to: '/real-world', label: 'Mundo real', icon: Globe2 },
  { to: '/glossary', label: 'Glosario y artículos', icon: BookA },
  { to: '/resources', label: 'Recursos', icon: BookOpen },
  { to: '/profile', label: 'Perfil y logros', icon: Trophy },
]

const MOBILE = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/map', label: 'Mapa', icon: Map },
  { to: '/lab', label: 'Lab', icon: Network },
  { to: '/interview', label: 'Entrevista', icon: Mic },
  { to: '/more', label: 'Más', icon: LayoutGrid },
]

function XpBadge({ compact = false }: { compact?: boolean }) {
  const xp = useGame((s) => s.xp)
  const activity = useGame((s) => s.activity)
  const lv = levelInfo(xp)
  const streak = streakOf(activity)
  return (
    <div className={compact ? 'flex items-center gap-3' : 'grid gap-2'}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-accent to-violet flex items-center justify-center font-extrabold text-[#04131a]">{lv.level}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">{lv.title}</div>
          {!compact && <ProgressBar value={lv.progress} height={6} />}
          <div className="text-[11px] text-muted tabular-nums">
            {xp} XP{lv.next ? ` · ${lv.toNext} para ${lv.next.title}` : ''}
          </div>
        </div>
      </div>
      <div className={`flex items-center gap-1 text-sm font-bold ${streak ? 'text-warn' : 'text-muted'}`} title="Racha de días">
        <Flame size={16} fill={streak ? 'currentColor' : 'none'} /> {streak}
        {!compact && <span className="text-xs font-normal text-muted">día{streak === 1 ? '' : 's'} de racha</span>}
      </div>
    </div>
  )
}

function ThemeToggle() {
  const theme = useGame((s) => s.settings.theme)
  const set = useGame((s) => s.setSettings)
  return (
    <button className="btn btn-ghost !p-2" aria-label="Cambiar tema" onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

export function Layout() {
  const theme = useGame((s) => s.settings.theme)
  const loc = useLocation()
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f4f6fb')
  }, [theme])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [loc.pathname])

  return (
    <div className="min-h-full lg:flex">
      {/* Sidebar escritorio */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-border bg-bg-2 p-4 gap-4">
        <div className="flex items-center gap-2 px-1">
          <img src="/favicon.svg" alt="" className="w-8 h-8" />
          <div>
            <div className="font-extrabold tracking-tight leading-none">SysDesign Quest</div>
            <div className="text-[11px] text-muted">System Design · Java · Python</div>
          </div>
        </div>
        <div className="card p-3">
          <XpBadge />
        </div>
        <nav className="grid gap-0.5 overflow-y-auto scrollbar-none">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'text-text' : 'text-muted hover:text-text hover:bg-surface'}`}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-surface-2 border border-border" />}
                  <n.icon size={17} className="relative" />
                  <span className="relative">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-[11px] text-muted">v0.1 · progreso local</span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Topbar móvil */}
        <header className="lg:hidden sticky top-0 z-30 backdrop-blur bg-bg/80 border-b border-border px-4 py-2 flex items-center justify-between gap-3" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
          <XpBadge compact />
          <ThemeToggle />
        </header>

        <main className="px-4 sm:px-6 lg:px-10 py-5 lg:py-8 pb-28 lg:pb-10 max-w-6xl mx-auto">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Tab bar móvil */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-bg-2/95 backdrop-blur grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {MOBILE.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? 'text-accent' : 'text-muted'}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab-active" className="absolute top-0 h-0.5 w-10 rounded bg-accent" />}
                <n.icon size={20} />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Toasts />
    </div>
  )
}

export { NAV }
