import { AlertTriangle } from 'lucide-react'
import type { DiscountEnvironment } from '#/features/stripe/types/discount-code'
import { cn } from '#/lib/utils'

export function EnvironmentBanner({
  environment,
  className,
}: {
  environment: DiscountEnvironment | null
  className?: string
}) {
  if (!environment) return null
  const isLive = environment === 'live'
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 border-b px-4 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em]',
        isLive
          ? 'border-[#7a1818] bg-[#bf2e2e] text-white'
          : 'border-[#1a3f8c] bg-[#2563d0] text-white',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="size-3.5" />
      {isLive ? 'LIVE MODE — production Stripe data' : 'TEST MODE — sandbox Stripe data'}
    </div>
  )
}
