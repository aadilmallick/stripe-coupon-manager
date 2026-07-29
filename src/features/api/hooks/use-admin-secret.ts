/**
 * Query + mutation hooks around the locally-stored admin secret.
 * The secret mirrors the server-side `ADMIN_PUBLISH_SECRET` env var.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  loadAdminSecret,
  saveAdminSecret,
  clearAdminSecret,
} from '#/storage/admin-secret-store'

export const adminSecretKey = ['admin-secret'] as const

export function useAdminSecret() {
  return useQuery<string | null>({
    queryKey: adminSecretKey,
    queryFn: loadAdminSecret,
    staleTime: Infinity,
  })
}

export function useSaveAdminSecret() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (secret: string) => {
      await saveAdminSecret(secret)
      return secret
    },
    onSuccess: (secret) => {
      qc.setQueryData(adminSecretKey, secret)
    },
  })
}

export function useClearAdminSecret() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await clearAdminSecret()
    },
    onSuccess: () => {
      qc.setQueryData(adminSecretKey, null)
    },
  })
}
