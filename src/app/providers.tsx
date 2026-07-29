import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't refetch on mount when query data is fresh — the user
            // explicitly hit Refresh when they want fresh data.
            refetchOnMount: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="bottom-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-lg',
          },
        }}
      />
    </QueryClientProvider>
  )
}
