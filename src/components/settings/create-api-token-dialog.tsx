/**
 * Dialog for creating a new API token. Plaintext is shown exactly once
 * after creation, with a copy-to-clipboard control + cURL example.
 *
 * The plaintext is cleared when the dialog closes.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter } from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import type { StripeWorkspace } from '#/features/stripe/types/workspace'
import { useAdminSecret } from '#/features/api/hooks/use-admin-secret'
import { useCreateApiToken } from '#/features/api/hooks/use-api-tokens'

const FormSchema = z.object({
  name: z.string().min(1, 'Name your token').max(80),
})

type FormInput = z.input<typeof FormSchema>
type FormValues = z.output<typeof FormSchema>

interface Props {
  open: boolean
  onOpenChange: (next: boolean) => void
  workspace: StripeWorkspace | null
  /** Optional site URL override for the cURL example (auto-detected otherwise). */
  siteUrl?: string
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`Copied ${label}`)
  } catch {
    // Fallback for non-HTTPS / older browsers.
    const ta = document.createElement('textarea')
    ta.value = value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      toast.success(`Copied ${label}`)
    } catch {
      toast.error('Copy failed — select the text manually.')
    } finally {
      document.body.removeChild(ta)
    }
  }
}

export function CreateApiTokenDialog({
  open,
  onOpenChange,
  workspace,
  siteUrl,
}: Props) {
  const secret = useAdminSecret()
  const create = useCreateApiToken()
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [last4, setLast4] = useState<string | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '' } as FormInput,
  })

  useEffect(() => {
    if (!open) {
      // Clear plaintext immediately on close so it can't linger in state.
      setPlaintext(null)
      setLast4(null)
      form.reset({ name: '' } as FormInput)
    }
  }, [open, form])

  async function onSubmit(values: FormValues) {
    if (!workspace) return
    try {
      const result = await create.mutateAsync({
        workspaceId: workspace.id,
        name: values.name,
      })
      setPlaintext(result.plaintext)
      setLast4(result.meta.last4)
      toast.success('Token created. Save it now — it will not be shown again.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Token creation failed.')
    }
  }

  if (!workspace) return null
  const noSecret = !secret.data
  const busy = create.isPending
  const baseUrl =
    siteUrl ?? (typeof window !== 'undefined' ? window.location.origin : '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={
          plaintext
            ? 'Save your API token'
            : `New API token · ${workspace.name}`
        }
        description={
          plaintext
            ? 'Copy it now. For your protection, the plaintext token is shown only once.'
            : 'Read-only access to this workspace\'s coupons. The plaintext is shown once and never stored on this device.'
        }
      >
        {plaintext ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Token</Label>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--sea-ink)]">
                  {plaintext}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(plaintext, 'token')}
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-[var(--sea-ink-soft)]">
                Ending in <span className="font-mono">{last4}</span>. Last4 is
                the only hint about this token that will appear in the
                Settings UI after you close this dialog.
              </p>
            </div>
            <CurlExample
              token={plaintext}
              workspaceId={workspace.id}
              baseUrl={baseUrl}
            />
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="token-name-input">Name</Label>
              <Input
                id="token-name-input"
                placeholder={`${workspace.name} — staging app`}
                autoFocus
                {...form.register('name')}
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-[var(--destructive)]">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            {noSecret ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Admin secret is not set.</strong> Save it in the card
                above before creating a token.
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || noSecret}
                onClick={form.handleSubmit(onSubmit)}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}

        {plaintext ? (
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CurlExample({
  token,
  workspaceId,
  baseUrl,
}: {
  token: string
  workspaceId: string
  baseUrl: string
}) {
  const cmd =
    `curl -X POST ${baseUrl || '<your-site>'}/api/discount-codes \\\n` +
    `  -H "X-API-Key: ${token}" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -d '{"workspaceId":"${workspaceId}","environment":"test"}'`
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Best-effort fallback.
      const ta = document.createElement('textarea')
      ta.value = cmd
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      } finally {
        document.body.removeChild(ta)
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>cURL example</Label>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 font-mono text-[11px] leading-relaxed text-[var(--sea-ink)]">
        {cmd}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="self-end gap-1.5"
        onClick={onCopy}
      >
        <Copy className="size-4" />
        {copied ? 'Copied' : 'Copy command'}
      </Button>
    </div>
  )
}
