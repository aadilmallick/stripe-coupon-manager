import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown, Plus, Settings } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import {
  usePreferencesQuery,
  useWorkspacesQuery,
} from '#/features/stripe/hooks/use-workspaces'
import { useSetSelectedWorkspace } from '#/features/stripe/hooks/use-current-selection'
import { envFromKey, maskKey } from '#/lib/env-key'

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const navigate = useNavigate()
  const workspaces = useWorkspacesQuery()
  const prefs = usePreferencesQuery()
  const setSelected = useSetSelectedWorkspace()
  const [open, setOpen] = useState(false)

  const list = workspaces.data ?? []
  const selectedId = prefs.data?.selectedWorkspaceId ?? null
  const current = list.find((w) => w.id === selectedId) ?? null

  if (!list.length) {
    return (
      <Button
        variant="default"
        size="sm"
        className={cn('gap-1.5', className)}
        onClick={() => navigate({ to: '/settings' })}
      >
        <Plus className="size-4" />
        Add workspace
      </Button>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={cn('h-9 w-[280px] justify-between gap-2', className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="island-kicker text-[0.55rem]">Workspace</span>
            <span className="truncate font-semibold">
              {current?.name ?? list[0]?.name ?? 'Select…'}
            </span>
          </span>
          <ChevronsUpDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px]">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {list.map((w) => {
          const hasTest = Boolean(envFromKey(w.testKey))
          const hasLive = Boolean(envFromKey(w.liveKey))
          const isCurrent = w.id === selectedId
          return (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => {
                if (isCurrent) {
                  setOpen(false)
                  return
                }
                setSelected(w.id)
                toast.success(`Switched to "${w.name}"`)
                setOpen(false)
              }}
              className={cn('flex-col items-stretch gap-0.5', isCurrent && 'bg-[var(--link-bg-hover)]')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{w.name}</span>
                <span className="flex gap-1">
                  {hasTest ? (
                    <span className="island-kicker rounded-full bg-[var(--chip-bg)] px-1.5 py-0.5 text-[0.5rem] text-[#2563d0]">
                      TEST
                    </span>
                  ) : null}
                  {hasLive ? (
                    <span className="island-kicker rounded-full bg-[var(--chip-bg)] px-1.5 py-0.5 text-[0.5rem] text-[#bf2e2e]">
                      LIVE
                    </span>
                  ) : null}
                </span>
              </div>
              <span className="text-xs text-[var(--sea-ink-soft)]">
                Test: {maskKey(w.testKey)} • Live: {maskKey(w.liveKey)}
              </span>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: '/settings' })}>
          <Settings className="size-4" />
          Manage workspaces…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/settings' })}>
          <Plus className="size-4" />
          Add workspace…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
