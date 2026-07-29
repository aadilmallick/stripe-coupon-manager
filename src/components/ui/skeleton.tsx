import { cn } from '#/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[color:color-mix(in_oklab,var(--chip-bg)_70%,transparent)]',
        className,
      )}
      {...props}
    />
  )
}
