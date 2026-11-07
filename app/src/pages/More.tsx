import { Link } from 'react-router-dom'
import { NAV } from '@/components/Layout'
import { SectionTitle } from '@/components/ui'

export default function More() {
  return (
    <div>
      <SectionTitle>Más</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {NAV.filter((n) => n.to !== '/').map((n) => (
          <Link key={n.to} to={n.to} className="card p-4 flex flex-col gap-2 hover:border-accent/60 transition-colors">
            <n.icon size={22} className="text-accent" />
            <span className="font-semibold text-sm">{n.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
