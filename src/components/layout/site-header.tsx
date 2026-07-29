import { Link } from '@tanstack/react-router'
import { Tag } from 'lucide-react'
import { cn } from '#/lib/utils'

interface NavItem {
  to: string
  label: string
}

const nav: NavItem[] = [
  { to: '/', label: 'Discount codes' },
  { to: '/settings', label: 'Settings' },
  { to: '/docs', label: 'API docs' },
  { to: '/about', label: 'About' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-md transition-colors">
      <div className="page-wrap flex h-16 items-center justify-between gap-6">
        <Link to="/" className="group flex items-center gap-2.5 no-underline">
          <span
            className="grid size-8 place-items-center rounded-xl text-white shadow-[0_8px_18px_-12px_rgba(50,143,151,0.7)]"
            style={{
              background:
                'linear-gradient(135deg,var(--lagoon) 0%,var(--lagoon-deep) 60%,var(--palm) 130%)',
            }}
          >
            <Tag className="size-4" />
          </span>
          <span className="display-title text-lg font-bold tracking-tight text-[var(--sea-ink)]">
            Discount&nbsp;Codes
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn('nav-link text-sm font-medium')}
              activeProps={{
                className: cn('nav-link is-active text-sm font-medium'),
              }}
              activeOptions={{ exact: n.to === '/' }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:hidden">
          <Link to="/settings" className="nav-link text-xs">
            Settings
          </Link>
        </div>
      </div>
    </header>
  )
}
