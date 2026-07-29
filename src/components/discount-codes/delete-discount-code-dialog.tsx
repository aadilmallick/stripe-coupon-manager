import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { useDeleteDiscountCode } from '#/features/stripe/hooks/use-discount-codes'
import type { SelectedWorkspaceContext } from '#/features/stripe/hooks/use-current-selection'
import type { DiscountCode } from '#/features/stripe/types/discount-code'

interface Props {
  open: boolean
  onOpenChange: (next: boolean) => void
  context: SelectedWorkspaceContext | null
  code: DiscountCode | null
}

export function DeleteDiscountCodeDialog({ open, onOpenChange, context, code }: Props) {
  const del = useDeleteDiscountCode(context)
  const [busy, setBusy] = useState(false)

  async function onConfirm() {
    if (!code || !context) return
    setBusy(true)
    onOpenChange(false)
    try {
      const result = await del.mutateAsync({ id: code.id, couponId: code.couponId })
      if (result.couponDeleted) {
        toast.success(`Deleted "${code.code}"`)
      } else {
        toast.warning(result.message ?? 'Stripe denied coupon deletion', {
          description: 'Code is now deactivated and can no longer be redeemed.',
          duration: 7000,
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete discount code')
    } finally {
      setBusy(false)
    }
  }

  if (!code) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Delete discount code"
        description="Stripe will deactivate the code, then attempt to delete the underlying coupon."
      >
        <DialogHeader>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
            <div className="flex items-center gap-2">
              <Trash2 className="size-4 text-[var(--destructive)]" />
              <span className="font-mono font-semibold text-[var(--sea-ink)]">
                {code.code}
              </span>
              <span className="island-kicker ml-auto">
                {code.timesRedeemed > 0
                  ? `${code.timesRedeemed} redeemed`
                  : 'never redeemed'}
              </span>
            </div>
          </div>
          <p className="text-sm text-[var(--sea-ink-soft)]">
            If the code has been redeemed, Stripe refuses to delete the coupon. We'll
            deactivate it instead and let you know.
          </p>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
