import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWorkspace,
  deleteWorkspace,
  loadWorkspaces,
  updateWorkspace,
} from '#/storage/workspace-store'
import { loadPreferences, savePreferences } from '#/storage/preferences-store'
import type { StripeWorkspace } from '#/features/stripe/types/workspace'

export const workspacesKey = ['workspaces'] as const
export const preferencesKey = ['preferences'] as const

export function useWorkspacesQuery() {
  return useQuery<StripeWorkspace[]>({
    queryKey: workspacesKey,
    queryFn: loadWorkspaces,
    staleTime: Infinity,
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      name: string
      description?: string
      testKey?: string
      liveKey?: string
    }) => createWorkspace(input),
    onSuccess: (created) => {
      qc.setQueryData<StripeWorkspace[]>(workspacesKey, (prev) =>
        prev ? [...prev, created] : [created],
      )
    },
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      patch: {
        name?: string
        description?: string
        testKey?: string
        liveKey?: string
      }
    }) => updateWorkspace(vars.id, vars.patch),
    onSuccess: (updated) => {
      qc.setQueryData<StripeWorkspace[]>(workspacesKey, (prev) =>
        prev ? prev.map((w) => (w.id === updated.id ? updated : w)) : [updated],
      )
    },
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<StripeWorkspace[]>(workspacesKey, (prev) =>
        prev ? prev.filter((w) => w.id !== id) : prev,
      )
    },
  })
}

export function usePreferencesQuery() {
  return useQuery({
    queryKey: preferencesKey,
    queryFn: loadPreferences,
    staleTime: Infinity,
  })
}

export function useUpdatePreference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      patch: Partial<{
        selectedWorkspaceId: string | null
        selectedEnvironment: 'test' | 'live'
        showOnlyActive: boolean
      }>,
    ) => savePreferences(patch),
    onSuccess: (next) => {
      qc.setQueryData(preferencesKey, next)
    },
  })
}
