/**
 * Settings card for the admin secret (browser-side copy of the
 *   `ADMIN_PUBLISH_SECRET` env var on Netlify).
 *
 * The secret protects server-side token mgmt + snapshot publishing.
 * It is stored in IndexedDB on this device and sent only to the same
 * project's server functions.
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  useAdminSecret,
  useSaveAdminSecret,
  useClearAdminSecret,
} from '#/features/api/hooks/use-admin-secret'

const FormSchema = z.object({
  secret: z.string().min(8, 'Must be at least 8 characters.'),
})

type FormValues = z.infer<typeof FormSchema>

export function AdminSecretCard() {
  const secret = useAdminSecret()
  const save = useSaveAdminSecret()
  const clear = useClearAdminSecret()
  const [editing, setEditing] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { secret: '' },
  })

  async function onSubmit(values: FormValues) {
    try {
      await save.mutateAsync(values.secret.trim())
      toast.success('Admin secret saved.')
      setEditing(false)
      form.reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  async function onClear() {
    const ok = window.confirm(
      'Remove the admin secret? Public API publishing and token management will be unavailable until you re-enter it.',
    )
    if (!ok) return
    try {
      await clear.mutateAsync()
      toast.success('Admin secret cleared.')
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not clear.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-[var(--lagoon-deep)]" />
          Public API admin secret
        </CardTitle>
        <CardDescription>
          The secret that unlocks server-side token management and snapshot
          publishing. Set this to the same value as your Netlify env var
          {' '}
          <code className="font-mono">ADMIN_PUBLISH_SECRET</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!secret.data || editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <Label htmlFor="admin-secret-input">Secret</Label>
            <Input
              id="admin-secret-input"
              type="password"
              placeholder="••••••••"
              autoComplete="off"
              {...form.register('secret')}
            />
            {form.formState.errors.secret ? (
              <p className="text-xs text-[var(--destructive)]">
                {form.formState.errors.secret.message}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>
              {secret.data ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <span className="text-sm text-[var(--sea-ink-soft)]">
              Saved. <span className="font-mono">********</span>
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--destructive)] hover:bg-[#fdecec]"
                onClick={onClear}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--sea-ink-soft)]">
          The secret is the same one you set in your{' '}
          <strong className="text-[var(--sea-ink)]">Netlify environment</strong>{' '}
          (no <code className="font-mono">VITE_</code> prefix). It is stored
          only in this browser's IndexedDB.
        </p>
      </CardContent>
    </Card>
  )
}
