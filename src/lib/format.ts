/**
 * Format a Unix-seconds timestamp (Stripe uses seconds) into a short date.
 */
export function formatDate(unixSeconds: number | string | null | undefined): string {
  if (!unixSeconds) return '—'
  const n = typeof unixSeconds === 'string' ? Number(unixSeconds) : unixSeconds
  if (!Number.isFinite(n)) return '—'
  const d = new Date(n * 1000)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatCurrency(amount: number | undefined, currency?: string) {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount / 100)
  } catch {
    return `${(amount / 100).toFixed(2)} ${(currency || 'USD').toUpperCase()}`
  }
}

export function formatPercent(value: number | undefined) {
  if (value == null) return '—'
  return `${value}% off`
}

export function formatDuration(d: string, months?: number | null) {
  if (d === 'once') return 'Once'
  if (d === 'forever') return 'Forever'
  return `For ${months ?? '?'} months`
}

export function compactNumber(n: number | null | undefined): string {
  if (n == null) return '∞'
  return n.toLocaleString()
}
