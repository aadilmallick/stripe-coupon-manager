import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--lagoon-deep)] text-white',
        secondary:
          'border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]',
        outline: 'border-[var(--line)] bg-transparent text-[var(--sea-ink)]',
        live:
          'border-transparent bg-[#bf2e2e] text-white',
        test:
          'border-transparent bg-[#2563d0] text-white',
        success:
          'border-transparent bg-[color:color-mix(in_oklab,var(--palm)_70%,white)] text-white',
        muted:
          'border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
        inactive:
          'border-[var(--line)] bg-[color:color-mix(in_oklab,var(--chip-bg)_60%,transparent)] text-[var(--sea-ink-soft)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
