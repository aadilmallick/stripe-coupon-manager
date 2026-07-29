import { Sparkles } from 'lucide-react'
import { cn } from '#/lib/utils'

export function DiscountCodesEmptyState({
  hasFilter,
  onCreate,
}: {
  hasFilter: boolean
  onCreate?: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[color:color-mix(in_oklab,var(--surface)_70%,transparent)] py-16 text-center',
      )}
    >
      <span
        className="grid size-12 place-items-center rounded-2xl text-white shadow-[0_8px_18px_-12px_rgba(50,143,151,0.6)]"
        style={{
          background:
            'linear-gradient(135deg,var(--lagoon) 0%,var(--lagoon-deep) 60%,var(--palm) 130%)',
        }}
      >
        <Sparkles className="size-5" />
      </span>
      <h3 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
        {hasFilter ? 'No matches.' : 'No discount codes found.'}
      </h3>
      <p className="max-w-md text-sm text-[var(--sea-ink-soft)]">
        {hasFilter
          ? 'Try a different code or name, or clear the search filter.'
          : 'Create your first one.'}
      </p>
      {!hasFilter && onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-12px_rgba(50,143,151,0.7)] transition-all hover:bg-[#246f76]"
        >
          Create your first discount code
        </button>
      ) : null}
    </div>
  )
}
