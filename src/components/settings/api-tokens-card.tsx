/**
 * Settings card listing API tokens, with per-workspace "New token" buttons
 * that open `CreateApiTokenDialog`.
 */
import { useEffect, useState } from 'react'
import { KeyRound, Plus, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { useApiTokensMeta, useForgetApiTokenMeta, useRevokeApiToken } from '#/features/api/hooks/use-api-tokens'
import { useAdminSecret } from '#/features/api/hooks/use-admin-secret'
import type { StripeWorkspace } from '#/features/stripe/types/workspace'
import { CreateApiTokenDialog } from './create-api-token-dialog'

interface Props {
  workspaces: StripeWorkspace[]
  siteUrl?: string
}

export function ApiTokensCard({ workspaces, siteUrl }: Props) {
  const tokens = useApiTokensMeta()
  const revoke = useRevokeApiToken()
  const forget = useForgetApiTokenMeta()
  const secret = useAdminSecret()
  const [createFor, setCreateFor] = useState<StripeWorkspace | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const list = tokens.data ?? []

  // Surface unresolved keyboard focus / stale data on workspace changes.
  useEffect(() => {
    /* tracked via busyId locally */
  }, [])

  async function onRevoke(id: string, name: string) {
    setBusyId(id)
    try {
      await revoke.mutateAsync(id)
      toast.success(`Revoked "${name}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revoke failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function onForget(id: string, name: string) {
    setBusyId(id)
    try {
      await forget.mutateAsync(id)
      toast.success(`Forgot "${name}" (local only — token is still on Netlify)`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-[var(--lagoon-deep)]" />
            API tokens
          </CardTitle>
          <CardDescription>
            Read-only tokens for external apps to fetch coupon snapshots via{' '}
            <code className="font-mono">POST /api/discount-codes</code>. Tokens
            are stored hashed (SHA-256) on Netlify; the plaintext is shown
            exactly once at creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!secret.data ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Save the admin secret</strong> first — token management
              and the public endpoint both depend on it.
            </p>
          ) : null}
          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--sea-ink-soft)]">
              No tokens yet. Create one from any workspace.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              {list.map((t) => {
                const ws = workspaces.find((w) => w.id === t.workspaceId)
                const isBusy = busyId === t.id
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-2 border-b border-[var(--line)] p-3 last:border-b-0 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{t.name}</span>
                        {t.revoked ? (
                          <Badge variant="muted">Revoked</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--sea-ink-soft)]">
                        Workspace:{' '}
                        <span className="font-semibold text-[var(--sea-ink)]">
                          {ws?.name ?? 'Unknown'}
                        </span>{' '}
                        · ends in{' '}
                        <span className="font-mono">{t.last4}</span> · created{' '}
                        {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!t.revoked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[var(--destructive)] hover:bg-[#fdecec]"
                          disabled={isBusy || !secret.data}
                          onClick={() => onRevoke(t.id, t.name)}
                        >
                          <ShieldOff className="size-3.5" />
                          Revoke
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy || !t.revoked}
                        title={
                          t.revoked
                            ? 'Forget this token record (local only)'
                            : 'Revoke on the server first before forgetting'
                        }
                        onClick={() => onForget(t.id, t.name)}
                      >
                        <Trash2 className="size-3.5" />
                        Forget
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {workspaces.length === 0 ? (
              <p className="text-xs text-[var(--sea-ink-soft)]">
                Add a workspace first to enable token creation.
              </p>
            ) : (
              workspaces.map((w) => (
                <Button
                  key={w.id}
                  variant="outline"
                  size="sm"
                  disabled={!secret.data}
                  onClick={() => setCreateFor(w)}
                >
                  <Plus className="size-3.5" />
                  New token — {w.name}
                </Button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <CreateApiTokenDialog
        open={createFor !== null}
        onOpenChange={(next) => !next && setCreateFor(null)}
        workspace={createFor}
        siteUrl={siteUrl}
      />
    </>
  )
}
