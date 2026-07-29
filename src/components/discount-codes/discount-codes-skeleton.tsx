import { Skeleton } from '#/components/ui/skeleton'

export function DiscountCodesSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)]">
      <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr_0.7fr_0.9fr_0.7fr] gap-0 border-b border-[var(--line)] bg-[color:color-mix(in_oklab,var(--chip-bg)_60%,transparent)] px-4 py-3">
        {['Code', 'Discount', 'Duration', 'Max', 'Redeemed', 'Created', 'Status'].map((h) => (
          <Skeleton key={h} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-[var(--line)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr_0.7fr_0.9fr_0.7fr] items-center gap-0 px-4 py-3"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
