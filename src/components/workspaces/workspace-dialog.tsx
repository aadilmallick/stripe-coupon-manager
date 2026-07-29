import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import {
  StripeWorkspaceFormSchema,
  type StripeWorkspaceFormValues,
} from '#/features/stripe/schemas/workspace'
import type { StripeWorkspace } from '#/features/stripe/types/workspace'
import {
  useCreateWorkspace,
  useUpdateWorkspace,
} from '#/features/stripe/hooks/use-workspaces'
import { useSetSelectedWorkspace } from '#/features/stripe/hooks/use-current-selection'

export function WorkspaceDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  editing?: StripeWorkspace | null
}) {
  const isEdit = Boolean(editing)
  const create = useCreateWorkspace()
  const update = useUpdateWorkspace()
  const setSelected = useSetSelectedWorkspace()

  const form = useForm<StripeWorkspaceFormValues>({
    resolver: zodResolver(StripeWorkspaceFormSchema),
    defaultValues: {
      name: '',
      testKey: '',
      liveKey: '',
    },
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? '',
        description: editing?.description ?? '',
        testKey: editing?.testKey ?? '',
        liveKey: editing?.liveKey ?? '',
      })
    }
  }, [open, editing, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const sanitized = {
        name: values.name,
        description: values.description?.trim() || undefined,
        testKey: values.testKey || undefined,
        liveKey: values.liveKey || undefined,
      }
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: sanitized })
        toast.success(`Updated "${sanitized.name}"`)
      } else {
        const created = await create.mutateAsync(sanitized)
        setSelected(created.id)
        toast.success(`Added "${created.name}"`)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    }
  })

  const busy = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? 'Edit workspace' : 'Add workspace'}
        description={
          isEdit
            ? 'Update the workspace name or replace an API key.'
            : 'Add a Stripe workspace. We never send keys off your device.'
        }
      >
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                placeholder="My SaaS"
                autoComplete="off"
                autoFocus
                {...form.register('name')}
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-[var(--destructive)]">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Label htmlFor="ws-description" className="flex items-center justify-between">
                <span>Description</span>
                <span className="island-kicker text-[0.55rem] opacity-60">optional</span>
              </Label>
              <textarea
                id="ws-description"
                rows={3}
                placeholder="e.g. Used by the marketing team for seasonal launches."
                className="flex w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-background resize-none"
                {...form.register('description')}
              />
              {form.formState.errors.description ? (
                <p className="text-xs text-[var(--destructive)]">
                  {form.formState.errors.description.message}
                </p>
              ) : (
                <p className="text-xs text-[var(--sea-ink-soft)]">
                  Included when sharing this workspace via email.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Label htmlFor="ws-test-key" className="flex items-center gap-2">
                Test secret key
                <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-[#2563d0]">
                  test
                </span>
              </Label>
              <Input
                id="ws-test-key"
                type="password"
                placeholder="sk_test_…"
                autoComplete="off"
                {...form.register('testKey')}
              />
              {form.formState.errors.testKey ? (
                <p className="text-xs text-[var(--destructive)]">
                  {form.formState.errors.testKey.message}
                </p>
              ) : (
                <p className="text-xs text-[var(--sea-ink-soft)]">
                  Must begin with sk_test_… Stored only in this browser.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Label htmlFor="ws-live-key" className="flex items-center gap-2">
                Live secret key
                <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-[#bf2e2e]">
                  live
                </span>
              </Label>
              <Input
                id="ws-live-key"
                type="password"
                placeholder="sk_live_…"
                autoComplete="off"
                {...form.register('liveKey')}
              />
              {form.formState.errors.liveKey ? (
                <p className="text-xs text-[var(--destructive)]">
                  {form.formState.errors.liveKey.message}
                </p>
              ) : (
                <p className="text-xs text-[var(--sea-ink-soft)]">
                  Must begin with sk_live_… Stored only in this browser.
                </p>
              )}
            </div>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Add workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
