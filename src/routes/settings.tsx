import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, KeyRound, Mail, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { WorkspaceDialog } from '#/components/workspaces/workspace-dialog'
import { EmailWorkspaceDialog } from '#/components/workspaces/email-workspace-dialog'
import {
  useDeleteWorkspace,
  usePreferencesQuery,
  useWorkspacesQuery,
} from '#/features/stripe/hooks/use-workspaces'
import { useSetSelectedWorkspace } from '#/features/stripe/hooks/use-current-selection'
import { envFromKey, maskKey } from '#/lib/env-key'
import {
  exportWorkspacesAsJson,
  importWorkspacesFromJson,
} from '#/storage/workspace-store'
import type { StripeWorkspace } from '#/features/stripe/types/workspace'
import type {
  DiscountCode,
  DiscountEnvironment,
} from '#/features/stripe/types/discount-code'
import { discountCodeRepository } from '#/features/stripe/repositories/discount-code-repository'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const workspaces = useWorkspacesQuery()
  const prefs = usePreferencesQuery()
  const setSelected = useSetSelectedWorkspace()
  const removeWorkspace = useDeleteWorkspace()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StripeWorkspace | null>(null)
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null)

  // Email-this-workspace state
  const [emailTarget, setEmailTarget] =
    useState<StripeWorkspace | null>(null)
  const [emailTest, setEmailTest] = useState<DiscountCode[]>([])
  const [emailLive, setEmailLive] = useState<DiscountCode[]>([])
  const [emailLoading, setEmailLoading] = useState(false)

  const list = workspaces.data ?? []
  const activeId = prefs.data?.selectedWorkspaceId ?? null

  useEffect(() => {
    if (!emailTarget) {
      setEmailTest([])
      setEmailLive([])
      return
    }
    let cancelled = false
    setEmailLoading(true)
    setEmailTest([])
    setEmailLive([])

    async function loadEnv(env: DiscountEnvironment, key?: string) {
      if (!key) return []
      try {
        return await discountCodeRepository.list(env, key)
      } catch {
        // Don't block the dialog — let the user see an empty state.
        return []
      }
    }

    Promise.all([loadEnv('test', emailTarget.testKey), loadEnv('live', emailTarget.liveKey)])
      .then(([test, live]) => {
        if (cancelled) return
        setEmailTest(test)
        setEmailLive(live)
      })
      .finally(() => {
        if (!cancelled) setEmailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [emailTarget])

  async function onExport() {
    try {
      const json = await exportWorkspacesAsJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `workspaces-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported workspace list')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  async function onImport(file: File) {
    try {
      const text = await file.text()
      const imported = await importWorkspacesFromJson(text, 'merge')
      toast.success(`Imported ${imported.length} workspaces`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    }
  }

  async function onDelete(id: string) {
    const ws = list.find((w) => w.id === id)
    if (!ws) return
    const ok = window.confirm(
      `Remove workspace "${ws.name}"? Keys will be deleted from this device.`,
    )
    if (!ok) return
    setBusyDeleteId(id)
    try {
      await removeWorkspace.mutateAsync(id)
      if (activeId === id) setSelected(null)
      toast.success(`Removed "${ws.name}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete workspace')
    } finally {
      setBusyDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="island-kicker">Settings</span>
        <h1 className="display-title text-3xl font-bold tracking-tight">
          Workspaces & keys
        </h1>
        <p className="max-w-2xl text-sm text-[var(--sea-ink-soft)]">
          Manage the Stripe workspaces saved in this browser. Keys are stored
          locally with localForage and used only for direct calls to Stripe
          from this device.
        </p>
      </div>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>
              {list.length} configured • {list.filter((w) => w.testKey).length} test •{' '}
              {list.filter((w) => w.liveKey).length} live
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)] transition-all hover:border-[color:color-mix(in_oklab,var(--lagoon-deep)_25%,var(--line))]">
              <Upload className="size-4" />
              Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImport(f)
                  e.target.value = ''
                }}
              />
            </label>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="size-4" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="size-4" />
              Add workspace
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] py-10 text-center">
              <KeyRound className="size-6 text-[var(--sea-ink-soft)]" />
              <p className="max-w-md text-sm text-[var(--sea-ink-soft)]">
                No workspaces yet. Add your first one to start managing discount
                codes locally.
              </p>
              <Button
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="size-4" />
                Add a workspace
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              {list.map((w) => {
                const isActive = w.id === activeId
                const testEnv = envFromKey(w.testKey)
                const liveEnv = envFromKey(w.liveKey)
                return (
                  <div
                    key={w.id}
                    className="flex flex-col gap-3 border-b border-[var(--line)] p-4 last:border-b-0 hover:bg-[var(--link-bg-hover)] md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{w.name}</span>
                        {isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelected(w.id)}
                            className="text-xs font-medium text-[var(--lagoon-deep)] hover:underline"
                          >
                            Make active
                          </button>
                        )}
                      </div>
                      {w.description ? (
                        <p className="mt-1 max-w-xl text-sm text-[var(--sea-ink-soft)]">
                          {w.description}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--sea-ink-soft)]">
                        <span className="flex items-center gap-1">
                          <Badge variant={testEnv ? 'test' : 'muted'}>
                            {testEnv ? 'TEST' : 'TEST—'}
                          </Badge>
                          <span className="font-mono">{maskKey(w.testKey)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Badge variant={liveEnv ? 'live' : 'muted'}>
                            {liveEnv ? 'LIVE' : 'LIVE—'}
                          </Badge>
                          <span className="font-mono">{maskKey(w.liveKey)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          !w.testKey && !w.liveKey
                        }
                        onClick={() => setEmailTarget(w)}
                        title="Email this workspace's codes to a teammate"
                      >
                        <Mail className="size-3.5" />
                        Email
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(w)
                          setDialogOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--destructive)] hover:bg-[#fdecec]"
                        disabled={busyDeleteId === w.id}
                        onClick={() => onDelete(w.id)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5 text-[var(--lagoon-deep)]" />
            Email
          </CardTitle>
          <CardDescription>
            Send workspace codes to a developer or teammate via Resend.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-[var(--sea-ink-soft)]">
          <p>
            Emails are dispatched from a{' '}
            <strong className="text-[var(--sea-ink)]">Netlify Cloud Function</strong>
            {' '}
            on the server, called from this browser through the TanStack Start
            RPC. Stripe keys never leave your device.
          </p>
          <p>
            Configure these in your Netlify environment (no <code>VITE_</code>{' '}
            prefix — they live on the server only):
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <code>RESEND_API_KEY</code> — Resend API key
            </li>
            <li>
              <code>RESEND_SENDER_DOMAIN</code> — verified sending domain
              (e.g. <code>mail.example.com</code>)
            </li>
          </ul>
          <p>
            If either env var is missing when the user clicks{' '}
            <em>Send</em>, the dialog renders an inline configuration card so
            it's obvious what to fix.
          </p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>How this app handles your data.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-[var(--sea-ink-soft)]">
          <p>• All Stripe API calls are made directly from this browser to api.stripe.com.</p>
          <p>• No analytics, no telemetry, no third-party tracking.</p>
          <p>• Workspace keys are persisted to IndexedDB via localForage.</p>
          <p>• Discount codes are not cached — they are always fetched live from Stripe.</p>
          <p>• Email sending happens server-side through a Netlify function; Resend credentials live in Netlify env vars and never reach the browser.</p>
        </CardContent>
      </Card>

      <WorkspaceDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next)
          if (!next) setEditing(null)
        }}
        editing={editing}
      />

      <EmailWorkspaceDialog
        open={Boolean(emailTarget)}
        onOpenChange={(next) => {
          if (!next) setEmailTarget(null)
        }}
        workspace={emailLoading ? null : emailTarget}
        testCodes={emailTest}
        liveCodes={emailLive}
      />
    </div>
  )
}
