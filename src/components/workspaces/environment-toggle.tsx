import { TestTube2, Zap } from 'lucide-react'
import { cn } from '#/lib/utils'
import {
  useSetSelectedEnvironment,
} from '#/features/stripe/hooks/use-current-selection'
import {
  usePreferencesQuery,
  useWorkspacesQuery,
} from '#/features/stripe/hooks/use-workspaces'
import type { DiscountEnvironment } from '#/features/stripe/types/discount-code'

export function EnvironmentToggle({ className }: { className?: string }) {
  const prefs = usePreferencesQuery()
  const workspaces = useWorkspacesQuery()
  const setEnv = useSetSelectedEnvironment()

  const selectedWorkspace = prefs.data?.selectedWorkspaceId
    ? workspaces.data?.find((w) => w.id === prefs.data?.selectedWorkspaceId)
    : undefined
  const env = prefs.data?.selectedEnvironment ?? 'test'

  if (!selectedWorkspace) return null

  const testDisabled = !selectedWorkspace.testKey
  const liveDisabled = !selectedWorkspace.liveKey
  const onlyOneAvailable =
    (testDisabled && !liveDisabled) || (!testDisabled && liveDisabled)

  const setIfCan = (next: DiscountEnvironment) => {
    if (next === env) return
    if (next === 'test' && testDisabled) return
    if (next === 'live' && liveDisabled) return
    setEnv(next)
  }

  return (
    <div
      className={cn(
        'inline-flex h-9 items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-0.5 text-sm font-semibold',
        className,
      )}
      role="tablist"
      aria-label="Environment"
    >
      <button
        role="tab"
        aria-selected={env === 'test'}
        disabled={!onlyOneAvailable && testDisabled}
        onClick={() => setIfCan('test')}
        className={cn(
          'flex h-full items-center gap-1.5 rounded-lg px-3 transition-all duration-150',
          env === 'test'
            ? 'bg-[#2563d0] text-white shadow-[0_4px_12px_-4px_rgba(37,99,208,0.6)]'
            : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]',
          testDisabled && env !== 'test' ? 'cursor-not-allowed opacity-40' : '',
        )}
      >
        <TestTube2 className="size-3.5" />
        Test
      </button>
      <button
        role="tab"
        aria-selected={env === 'live'}
        disabled={!onlyOneAvailable && liveDisabled}
        onClick={() => setIfCan('live')}
        className={cn(
          'flex h-full items-center gap-1.5 rounded-lg px-3 transition-all duration-150',
          env === 'live'
            ? 'bg-[#bf2e2e] text-white shadow-[0_4px_12px_-4px_rgba(191,46,46,0.6)]'
            : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]',
          liveDisabled && env !== 'live' ? 'cursor-not-allowed opacity-40' : '',
        )}
      >
        <Zap className="size-3.5" />
        Live
      </button>
    </div>
  )
}
