import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, RefreshCw, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { Badge } from '#/components/ui/badge'
import { WorkspaceSwitcher } from '#/components/workspaces/workspace-switcher'
import { EnvironmentToggle } from '#/components/workspaces/environment-toggle'
import { CreateDiscountCodeDialog } from '#/components/discount-codes/create-discount-code-dialog'
import { DeleteDiscountCodeDialog } from '#/components/discount-codes/delete-discount-code-dialog'
import { DiscountCodesTable } from '#/components/discount-codes/discount-codes-table'
import { DiscountCodesEmptyState } from '#/components/discount-codes/empty-state'
import { DiscountCodesSkeleton } from '#/components/discount-codes/discount-codes-skeleton'
import { StripeErrorCallout } from '#/components/discount-codes/error-callout'
import {
  useCurrentSelection,
  useToggleShowOnlyActive,
} from '#/features/stripe/hooks/use-current-selection'
import {
  discountCodesKey,
  useDiscountCodes,
  useValidateKey,
} from '#/features/stripe/hooks/use-discount-codes'
import { usePublishCouponSnapshot } from '#/features/api/hooks/use-publish-coupon-snapshot'
import { discountCodeRepository } from '#/features/stripe/repositories/discount-code-repository'
import {
  usePreferencesQuery,
} from '#/features/stripe/hooks/use-workspaces'
import type { DiscountCode } from '#/features/stripe/types/discount-code'

export const Route = createFileRoute('/')({
  component: DiscountCodesPage,
})

function DiscountCodesPage() {
  const ctx = useCurrentSelection()
  const prefs = usePreferencesQuery()
  const setShowOnlyActive = useToggleShowOnlyActive()
  const discountQuery = useDiscountCodes(ctx)
  const keyQuery = useValidateKey(ctx)
  const qc = useQueryClient()
  const publish = usePublishCouponSnapshot()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DiscountCode | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const codes = discountQuery.data ?? []
  const onlyActive = prefs.data?.showOnlyActive ?? true
  const q = search.trim().toLowerCase()

  const view = useMemo(() => {
    return codes.filter((c) => {
      if (onlyActive && !c.active) return false
      if (!q) return true
      return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    })
  }, [codes, q, onlyActive])

  // Empty / onboarding state when no workspace is selected.
  if (!ctx) {
    return <NoWorkspace />
  }

  const refreshing = discountQuery.isFetching && !discountQuery.isPending

  async function onRefresh() {
    if (!ctx) return
    const fetchedAt = new Date().toISOString()
    try {
      // 1. Pull a fresh list from Stripe (writes to IndexedDB cache as
      //    a side effect of the queryFn).
      const fresh = await qc.fetchQuery<DiscountCode[]>({
        queryKey: discountCodesKey(ctx.workspace.id, ctx.environment),
        queryFn: ({ signal }) =>
          discountCodeRepository.list(ctx.environment, ctx.apiKey, signal),
      })
      qc.setQueryData<DiscountCode[]>(
        discountCodesKey(ctx.workspace.id, ctx.environment),
        fresh,
      )
      toast.success('Synced with Stripe')
      // 2. Mirror to Netlify Blobs so the public API endpoint serves the
      //    latest data. Best-effort — local cache is still up-to-date.
      const result = await publish.mutateAsync({
        workspaceId: ctx.workspace.id,
        workspaceName: ctx.workspace.name,
        environment: ctx.environment,
        codes: fresh,
        fetchedAt,
      })
      if (!result.ok && result.reason === 'no-secret') {
        toast.info('Synced locally. Set admin secret in Settings to publish snapshots.', {
          description: result.error,
        })
      } else if (!result.ok) {
        toast.warning('Synced locally, but the public snapshot was not published.', {
          description: result.error,
        })
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not refresh from Stripe',
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        workspaceName={ctx.workspace.name}
        environment={ctx.environment}
        accountLabel={
          keyQuery.data?.displayName ?? (keyQuery.isError ? 'Stripe key error' : 'Verifying key…')
        }
      >
        <EnvironmentToggle />
        <WorkspaceSwitcher />
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={discountQuery.isPending || refreshing}
        >
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New discount code
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--sea-ink-soft)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or name…"
              className="pl-9"
              aria-label="Search discount codes"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--sea-ink-soft)]">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
              className="size-4 cursor-pointer rounded border-[var(--line)] accent-[var(--lagoon-deep)]"
            />
            Active only
          </label>
        </div>

        {discountQuery.isPending ? (
          <DiscountCodesSkeleton />
        ) : discountQuery.isError ? (
          <StripeErrorCallout error={discountQuery.error} />
        ) : view.length === 0 ? (
          <DiscountCodesEmptyState
            hasFilter={Boolean(q) || onlyActive}
            onCreate={() => setCreateOpen(true)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-[var(--sea-ink-soft)]">
              <span>
                Showing <strong className="text-[var(--sea-ink)]">{view.length}</strong>{' '}
                of {discountQuery.data?.length ?? 0}
              </span>
              <span>
                Synced{' '}
                {discountQuery.dataUpdatedAt
                  ? new Date(discountQuery.dataUpdatedAt).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
            <DiscountCodesTable
              codes={view}
              onDelete={(c) => setPendingDelete(c)}
              highlightId={highlightId}
            />
          </div>
        )}
      </div>

      <CreateDiscountCodeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        context={ctx}
        onCreated={(id) => setHighlightId(id)}
      />
      <DeleteDiscountCodeDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        context={ctx}
        code={pendingDelete}
      />
    </div>
  )
}

function PageHeader({
  workspaceName,
  environment,
  accountLabel,
  children,
}: {
  workspaceName: string
  environment: 'test' | 'live'
  accountLabel: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="island-kicker text-[var(--kicker)]">Workspace</span>
          <Badge variant={environment === 'live' ? 'live' : 'test'}>
            {environment === 'live' ? 'LIVE' : 'TEST'}
          </Badge>
        </div>
        <h1 className="display-title text-3xl font-bold tracking-tight text-[var(--sea-ink)]">
          {workspaceName}
        </h1>
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Connected as{' '}
          <span className="font-mono text-[var(--sea-ink)]">{accountLabel}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function NoWorkspace() {
  return (
    <div className="grid place-items-center py-16">
      <Card className="max-w-2xl p-0">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-2xl text-white shadow-[0_8px_18px_-12px_rgba(50,143,151,0.7)]"
              style={{
                background:
                  'linear-gradient(135deg,var(--lagoon) 0%,var(--lagoon-deep) 60%,var(--palm) 130%)',
              }}
            >
              <Sparkles className="size-5" />
            </span>
            <div>
              <CardTitle>Welcome.</CardTitle>
              <CardDescription>
                Add a Stripe workspace to start managing discount codes locally.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-[var(--sea-ink-soft)]">
            We hide the difference between Stripe coupons and promotion codes so you
            only ever think about one thing: <strong>discount codes</strong>. Keys
            stay in this browser — they never touch a server.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-12px_rgba(50,143,151,0.7)] transition-all hover:bg-[#246f76]"
            >
              <Plus className="size-4" />
              Add a workspace
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition-all hover:border-[color:color-mix(in_oklab,var(--lagoon-deep)_25%,var(--line))]"
            >
              How it works
            </Link>
          </div>
          <Skeleton className="h-1 w-full rounded-full" />
        </CardContent>
      </Card>
    </div>
  )
}


