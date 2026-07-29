import { useMemo } from 'react'
import {
  usePreferencesQuery,
  useUpdatePreference,
  useWorkspacesQuery,
} from './use-workspaces'
import type { StripeWorkspace } from '#/features/stripe/types/workspace'
import type { DiscountEnvironment } from '#/features/stripe/types/discount-code'

export interface SelectedWorkspaceContext {
  workspace: StripeWorkspace
  environment: DiscountEnvironment
  apiKey: string
}

/**
 * Resolves the active workspace + environment + Stripe API key.
 * Returns `null` until preferences have loaded, and `null` again if no
 * valid (workspace + api key) combination exists.
 */
export function useCurrentSelection(): SelectedWorkspaceContext | null {
  const prefs = usePreferencesQuery()
  const workspaces = useWorkspacesQuery()

  return useMemo(() => {
    if (!prefs.data || !workspaces.data) return null
    const id = prefs.data.selectedWorkspaceId
    if (!id) return null
    const found = workspaces.data.find((w) => w.id === id)
    if (!found) return null
    const env = prefs.data.selectedEnvironment
    const apiKey = env === 'live' ? found.liveKey : found.testKey
    if (!apiKey) return null
    return { workspace: found, environment: env, apiKey }
  }, [prefs.data, workspaces.data])
}

export function useSetSelectedWorkspace() {
  const m = useUpdatePreference()
  return (id: string | null) => m.mutate({ selectedWorkspaceId: id })
}

export function useSetSelectedEnvironment() {
  const m = useUpdatePreference()
  return (env: DiscountEnvironment) => m.mutate({ selectedEnvironment: env })
}

export function useToggleShowOnlyActive() {
  const m = useUpdatePreference()
  return (next: boolean) => m.mutate({ showOnlyActive: next })
}
