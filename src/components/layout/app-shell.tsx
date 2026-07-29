import type { ReactNode } from 'react'
import { EnvironmentBanner } from './environment-banner'
import { SiteHeader } from './site-header'
import { useCurrentSelection } from '#/features/stripe/hooks/use-current-selection'

export function AppShell({ children }: { children: ReactNode }) {
  const selection = useCurrentSelection()
  return (
    <div className="relative flex min-h-dvh flex-col">
      <EnvironmentBanner environment={selection?.environment ?? null} />
      <SiteHeader />
      <main className="page-wrap flex-1 py-8">
        <div className="rise-in">{children}</div>
      </main>
      <footer className="site-footer mt-12 py-6">
        <div className="page-wrap flex items-center justify-between text-xs text-[var(--sea-ink-soft)]">
          <span>Keys never leave your browser.</span>
          <span className="font-medium">Built for discount code management.</span>
        </div>
      </footer>
    </div>
  )
}
