import { useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, Copy, Trash2 } from 'lucide-react'

function copyToClipboard(text: string) {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`Copied "${text}"`))
      .catch(() => fallbackCopy(text))
    return
  }
  fallbackCopy(text)
}

function fallbackCopy(text: string) {
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    if (ok) toast.success(`Copied "${text}"`)
    else toast.error('Could not copy to clipboard')
  } catch {
    toast.error('Could not copy to clipboard')
  }
}
import { toast } from 'sonner'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { cn } from '#/lib/utils'
import type { DiscountCode } from '#/features/stripe/types/discount-code'
import { compactNumber, formatCurrency, formatDate, formatDuration, formatPercent } from '#/lib/format'

type SortKey = 'code' | 'discount' | 'duration' | 'maxRedemptions' | 'timesRedeemed' | 'createdAt' | 'active'

interface Props {
  codes: DiscountCode[]
  onDelete: (code: DiscountCode) => void
  highlightId?: string | null
}

export function DiscountCodesTable({ codes, onDelete, highlightId }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: 'createdAt',
    asc: false,
  })

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, asc: !s.asc } : { key, asc: key === 'code' || key === 'duration' },
    )
  }

  const sorted = [...codes].sort((a, b) => {
    const dir = sort.asc ? 1 : -1
    function value(item: DiscountCode): string | number {
      switch (sort.key) {
        case 'code':
          return item.code.toLowerCase()
        case 'discount':
          return item.discountType === 'percent' ? -(item.percentOff ?? 0) : -(item.amountOff ?? 0)
        case 'duration':
          return item.duration
        case 'maxRedemptions':
          return item.maxRedemptions ?? Infinity
        case 'timesRedeemed':
          return item.timesRedeemed
        case 'createdAt':
          return new Date(item.createdAt).getTime()
        case 'active':
          return item.active ? 1 : 0
      }
    }
    const av = value(a)
    const bv = value(b)
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })

  function renderDiscount(c: DiscountCode) {
    if (c.discountType === 'percent') return formatPercent(c.percentOff)
    return formatCurrency(c.amountOff, c.currency)
  }
  function renderDuration(c: DiscountCode) {
    return formatDuration(c.duration, c.durationMonths)
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--line)] bg-[color:color-mix(in_oklab,var(--chip-bg)_60%,transparent)] text-[var(--sea-ink-soft)]">
              <SortHeader label="Code" sortKey="code" sort={sort} onToggle={toggle} align="left" />
              <SortHeader label="Discount" sortKey="discount" sort={sort} onToggle={toggle} />
              <SortHeader label="Duration" sortKey="duration" sort={sort} onToggle={toggle} />
              <SortHeader label="Max Uses" sortKey="maxRedemptions" sort={sort} onToggle={toggle} />
              <SortHeader label="Redeemed" sortKey="timesRedeemed" sort={sort} onToggle={toggle} />
              <SortHeader label="Created" sortKey="createdAt" sort={sort} onToggle={toggle} />
              <SortHeader label="Status" sortKey="active" sort={sort} onToggle={toggle} />
              <th className="px-3 py-3 text-right text-[0.7rem] font-bold uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {sorted.map((c) => {
              const isHighlighted = highlightId === c.id
              return (
                <tr
                  key={c.id}
                  className={cn(
                    'group transition-colors',
                    'hover:bg-[color:color-mix(in_oklab,var(--link-bg-hover)_85%,transparent)]',
                    isHighlighted &&
                      'bg-[color:color-mix(in_oklab,var(--lagoon)_18%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--lagoon)_24%,transparent)]',
                  )}
                >
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(c.code)}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[0.85rem] font-semibold text-[var(--lagoon-deep)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--chip-bg)_70%,transparent)]"
                      title="Click to copy"
                    >
                      <span className="truncate">{c.code}</span>
                      <Copy className="size-3.5 opacity-50 group-hover:opacity-100" />
                    </button>
                    {c.name && c.name !== c.code ? (
                      <div className="mt-0.5 px-2 text-[0.7rem] text-[var(--sea-ink-soft)] truncate" title={c.name}>
                        {c.name}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--sea-ink)]">
                    {renderDiscount(c)}
                  </td>
                  <td className="px-3 py-3 text-[var(--sea-ink-soft)]">
                    {renderDuration(c)}
                  </td>
                  <td className="px-3 py-3 text-[var(--sea-ink-soft)]">
                    {compactNumber(c.maxRedemptions)}
                  </td>
                  <td className="px-3 py-3 text-[var(--sea-ink-soft)]">
                    <span className="font-medium text-[var(--sea-ink)]">
                      {c.timesRedeemed}
                    </span>
                    {c.maxRedemptions ? (
                      <span className="text-[var(--sea-ink-soft)]">
                        {' '}
                        / {c.maxRedemptions}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-[var(--sea-ink-soft)]">
                    {formatDate(new Date(c.createdAt).getTime() / 1000)}
                  </td>
                  <td className="px-3 py-3">
                    {c.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="inactive">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--destructive)] hover:bg-[#fdecec]"
                        onClick={() => onDelete(c)}
                        aria-label={`Delete ${c.code}`}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

interface SortHeaderProps {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; asc: boolean }
  onToggle: (k: SortKey) => void
  align?: 'left' | 'right'
}

function SortHeader({ label, sortKey, sort, onToggle, align = 'right' }: SortHeaderProps) {
  const active = sort.key === sortKey
  return (
    <th className={cn('px-3 py-3 text-[0.7rem] font-bold uppercase tracking-wider', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors',
          active ? 'text-[var(--sea-ink)]' : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]',
        )}
      >
        {label}
        {active ? (
          sort.asc ? (
            <ArrowUpAZ className="size-3" />
          ) : (
            <ArrowDownAZ className="size-3" />
          )
        ) : null}
      </button>
    </th>
  )
}
