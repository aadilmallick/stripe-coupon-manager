import { AlertCircle } from 'lucide-react'
import { StripeApiError, StripeNetworkError } from '#/features/stripe/api/client'

function friendlyMessage(err: unknown): string {
  if (err instanceof StripeNetworkError) {
    return "Couldn't reach Stripe. Check your network and try again."
  }
  if (err instanceof StripeApiError) {
    if (err.status === 401) {
      return 'This Stripe key looks invalid or expired. Update it from Settings.'
    }
    if (err.status === 403) {
      return 'Stripe refused access. Make sure your key has the right permissions.'
    }
    if (err.status === 429) {
      return 'Stripe rate-limited us. Give it a few seconds and try again.'
    }
    if (err.status >= 500) {
      return 'Stripe is having issues on their end. Try again shortly.'
    }
    return err.message || 'Something went wrong talking to Stripe.'
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong talking to Stripe.'
}

export function StripeErrorCallout({ error }: { error: unknown }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[color:color-mix(in_oklab,var(--destructive)_30%,var(--line))] bg-[color:color-mix(in_oklab,var(--destructive)_8%,var(--surface-strong))] p-4">
      <AlertCircle className="mt-0.5 size-5 text-[var(--destructive)]" />
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="font-semibold text-[var(--destructive-foreground)]">
          We couldn't load your discount codes.
        </span>
        <span className="text-[var(--sea-ink-soft)]">{friendlyMessage(error)}</span>
      </div>
    </div>
  )
}
