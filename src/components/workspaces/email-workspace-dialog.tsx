import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { AlertTriangle, Loader2, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'
import type {
  DiscountCode,
  DiscountEnvironment,
} from '#/features/stripe/types/discount-code'
import type { StripeWorkspace } from '#/features/stripe/types/workspace'
import type { ShareItem } from '#/lib/email-template'
import { sendDiscountCodesEmailServerFn } from '#/server/email'

const EmailFormSchema = z.object({
  to: z.string().email('Enter a valid email address'),
  note: z.string().max(2000).optional(),
  includeTest: z.boolean(),
  includeLive: z.boolean(),
})

type EmailFormValues = z.infer<typeof EmailFormSchema>
type EmailFormInput = z.input<typeof EmailFormSchema>

interface Props {
  open: boolean
  onOpenChange: (next: boolean) => void
  workspace: StripeWorkspace | null
  /** Re-use the discount codes already loaded for the workspace, per env. */
  testCodes: DiscountCode[]
  liveCodes: DiscountCode[]
}

class NothingToSendError extends Error {
  constructor() {
    super('Nothing to send')
    this.name = 'NothingToSendError'
  }
}

function toShareItem(c: DiscountCode): ShareItem {
  return {
    code: c.code,
    name: c.name,
    discountType: c.discountType,
    percentOff: c.percentOff,
    amountOff: c.amountOff,
    currency: c.currency,
    duration: c.duration,
    durationMonths: c.durationMonths,
    maxRedemptions: c.maxRedemptions,
    timesRedeemed: c.timesRedeemed,
    active: c.active,
    environment: c.environment,
  }
}

export function EmailWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  testCodes,
  liveCodes,
}: Props) {
  const form = useForm<EmailFormInput, unknown, EmailFormValues>({
    resolver: zodResolver(EmailFormSchema),
    defaultValues: {
      to: '',
      note: '',
      includeTest: true,
      includeLive: true,
    } as EmailFormInput,
    mode: 'onBlur',
  })

  // Inline configuration-error banner if the server reports no Resend config.
  const [missingConfig, setMissingConfig] = useState(false)

  useEffect(() => {
    if (open) {
      setMissingConfig(false)
      form.reset({
        to: '',
        note: '',
        includeTest: true,
        includeLive: true,
      } as EmailFormInput)
    }
  }, [open, form])

  const mutation = useMutation({
    mutationFn: async (values: EmailFormValues) => {
      if (!workspace) throw new Error('No workspace selected')
      const byEnvironment: Record<DiscountEnvironment, DiscountCode[]> = {
        test: values.includeTest ? testCodes : [],
        live: values.includeLive ? liveCodes : [],
      }
      const items: ShareItem[] = []
      for (const env of ['test', 'live'] as DiscountEnvironment[]) {
        for (const c of byEnvironment[env]) items.push(toShareItem(c))
      }
      if (items.length === 0) {
        // Inline banner elsewhere explains this; skip the toast.
        throw new NothingToSendError()
      }

      const note = values.note?.trim()
      return sendDiscountCodesEmailServerFn({
        data: {
          to: values.to.trim(),
          recipientName: undefined,
          workspaceName: workspace.name,
          workspaceDescription: workspace.description?.trim() || undefined,
          note: note && note.length > 0 ? note : undefined,
          items,
          subjectOverride: `Discount codes from ${workspace.name}`,
        },
      })
    },
  })

  const includeTest = form.watch('includeTest')
  const includeLive = form.watch('includeLive')

  async function onSubmit(values: EmailFormValues) {
    setMissingConfig(false)
    try {
      const result = await mutation.mutateAsync(values)
      if (result.ok) {
        onOpenChange(false)
        toast.success(
          `Sent ${result.provider === 'resend' ? 'via Resend' : 'successfully'}.`,
        )
        return
      }
      if (result.reason === 'no-resend-config') {
        setMissingConfig(true)
        toast.error('Resend is not configured on the server.', {
          description:
            'Add RESEND_API_KEY and RESEND_SENDER_DOMAIN to your Netlify environment variables.',
        })
        return
      }
      toast.error(result.error ?? 'Resend rejected the message.')
    } catch (err) {
      if (err instanceof NothingToSendError) {
        // Inline banner explains this; no toast.
        return
      }
      toast.error(err instanceof Error ? err.message : 'Could not reach the server.')
    }
  }

  if (!workspace) return null

  const total = (includeTest ? testCodes.length : 0) + (includeLive ? liveCodes.length : 0)
  const busy = mutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Email this workspace"
        description={`Send the discount codes for "${workspace.name}" to a teammate or developer.`}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-to">Recipient</Label>
              <Input
                id="email-to"
                type="email"
                placeholder="dev@example.com"
                autoComplete="email"
                autoFocus
                {...form.register('to')}
              />
              {form.formState.errors.to ? (
                <p className="text-xs text-[var(--destructive)]">
                  {form.formState.errors.to.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Label>Environments to include</Label>
              <div className="flex gap-2">
                <EnvironmentToggle
                  label="Test"
                  badgeVariant="test"
                  count={testCodes.length}
                  checked={includeTest}
                  disabled={testCodes.length === 0}
                  onChange={(v) =>
                    form.setValue('includeTest', v, { shouldDirty: true })
                  }
                />
                <EnvironmentToggle
                  label="Live"
                  badgeVariant="live"
                  count={liveCodes.length}
                  checked={includeLive}
                  disabled={liveCodes.length === 0}
                  onChange={(v) =>
                    form.setValue('includeLive', v, { shouldDirty: true })
                  }
                />
              </div>
              <p className="text-xs text-[var(--sea-ink-soft)]">
                {total === 0
                  ? 'No codes available for the selected environments.'
                  : `${total} ${total === 1 ? 'code' : 'codes'} will be sent.`}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Label htmlFor="email-note" className="flex items-center gap-2">
                Personal note
                <span className="island-kicker text-[0.55rem] opacity-60">
                  optional
                </span>
              </Label>
              <textarea
                id="email-note"
                rows={3}
                placeholder="Hey! Here are the codes for the launch…"
                className="flex w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-background resize-none"
                {...form.register('note')}
              />
            </div>

            <ConfigurationNote missing={missingConfig} />

            <div
              className={cn(
                'mt-1 flex items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs text-[var(--sea-ink-soft)]',
              )}
            >
              <Mail className="mt-0.5 size-4 text-[var(--sea-ink-soft)]" />
              <span>
                Sent securely via{' '}
                <strong className="text-[var(--sea-ink)]">
                  Netlify Cloud Functions
                </strong>{' '}
                + Resend. Stripe keys stay in this browser and never reach
                the server.
              </span>
            </div>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {total === 0 ? 'Nothing to send' : 'Send'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConfigurationNote({ missing }: { missing: boolean }) {
  if (!missing) return null
  return (
    <div className="mt-1 flex items-start gap-2 rounded-xl border border-[color:color-mix(in_oklab,var(--destructive)_30%,var(--line))] bg-[color:color-mix(in_oklab,var(--destructive)_8%,var(--surface-strong))] p-3 text-xs">
      <AlertTriangle className="mt-0.5 size-4 text-[var(--destructive)]" />
      <span className="text-[var(--sea-ink-soft)]">
        <strong className="text-[var(--destructive)]">
          Resend is not configured.
        </strong>{' '}
        Add{' '}
        <code className="rounded border border-[var(--line)] bg-[color:color-mix(in_oklab,var(--surface-strong)_70%,transparent)] px-1 py-px text-[0.7rem]">
          RESEND_API_KEY
        </code>{' '}
        and{' '}
        <code className="rounded border border-[var(--line)] bg-[color:color-mix(in_oklab,var(--surface-strong)_70%,transparent)] px-1 py-px text-[0.7rem]">
          RESEND_SENDER_DOMAIN
        </code>{' '}
        to your{' '}
        <strong className="text-[var(--sea-ink)]">Netlify environment</strong>{' '}
        and redeploy. (No <code>VITE_</code> prefix — they live on the
        server only.)
      </span>
    </div>
  )
}

function EnvironmentToggle({
  label,
  badgeVariant,
  count,
  checked,
  disabled,
  onChange,
}: {
  label: string
  badgeVariant: 'test' | 'live'
  count: number
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'flex flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all',
        checked
          ? badgeVariant === 'test'
            ? 'border-[#1a3f8c]/40 bg-[#f0f4ff] text-[var(--sea-ink)]'
            : 'border-[#7a1818]/40 bg-[#fdecec] text-[var(--sea-ink)]'
          : 'border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] hover:border-[color:color-mix(in_oklab,var(--lagoon-deep)_25%,var(--line))]',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <span className="flex items-center gap-2">
        <Badge variant={badgeVariant}>
          {badgeVariant === 'live' ? 'LIVE' : 'TEST'}
        </Badge>
        <span className="font-semibold">{label}</span>
      </span>
      <span className="text-xs text-[var(--sea-ink-soft)]">
        {count} {count === 1 ? 'code' : 'codes'}
      </span>
    </button>
  )
}
