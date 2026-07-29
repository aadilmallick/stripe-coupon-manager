import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '#/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon-deep)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--lagoon-deep)] text-white shadow-[0_8px_18px_-12px_rgba(50,143,151,0.7)] hover:bg-[#246f76] active:translate-y-px',
        secondary:
          'border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] hover:border-[color:color-mix(in_oklab,var(--lagoon-deep)_30%,var(--line))]',
        outline:
          'border border-[var(--line)] bg-transparent text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)] hover:border-[color:color-mix(in_oklab,var(--lagoon-deep)_25%,var(--line))]',
        ghost:
          'bg-transparent text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
        destructive:
          'bg-[var(--destructive)] text-white shadow-[0_8px_18px_-12px_rgba(220,80,80,0.6)] hover:brightness-110',
        live:
          'bg-[#bf2e2e] text-white shadow-[0_8px_18px_-12px_rgba(191,46,46,0.7)] hover:bg-[#a51c1c]',
        test:
          'bg-[#2563d0] text-white shadow-[0_8px_18px_-12px_rgba(37,99,208,0.6)] hover:bg-[#1d4fa6]',
        link: 'text-[var(--lagoon-deep)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
