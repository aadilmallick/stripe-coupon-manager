import type { DiscountEnvironment } from '#/features/stripe/types/discount-code'

/**
 * Determine test/live environment from a Stripe secret key prefix.
 * Stripe NOTE: keys start with sk_test_… or sk_live_…
 */
export function envFromKey(key: string | undefined): DiscountEnvironment | null {
  if (!key) return null
  if (key.startsWith('sk_live_')) return 'live'
  if (key.startsWith('sk_test_')) return 'test'
  if (key.startsWith('rk_live_')) return 'live'
  if (key.startsWith('rk_test_')) return 'test'
  return null
}

/**
 * Mask a Stripe API key for display: keep the first 7 chars + last 4.
 * e.g. sk_test_…abcd
 */
export function maskKey(key: string | undefined): string {
  if (!key) return '—'
  if (key.length <= 12) return '•'.repeat(key.length)
  return `${key.slice(0, 7)}•••${key.slice(-4)}`
}
