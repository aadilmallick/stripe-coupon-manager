/**
 * TanStack Query hooks around the API token metadata. Plaintext tokens
 * never reach this module — only the metadata returned by the server
 * fn.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createApiTokenServerFn,
  listApiTokensServerFn,
  revokeApiTokenServerFn,
} from '#/server/api-tokens'
import {
  addApiToken,
  loadApiTokens,
  markTokenRevoked,
  forgetApiToken,
  setApiTokens,
} from '#/storage/api-token-meta-store'
import type { ApiTokenMeta } from '#/server/types'

export const apiTokensMetaKey = ['api-tokens-meta'] as const

export function useApiTokensMeta() {
  return useQuery<ApiTokenMeta[]>({
    queryKey: apiTokensMetaKey,
    queryFn: loadApiTokens,
    staleTime: Infinity,
  })
}

export interface CreateApiTokenResult {
  meta: ApiTokenMeta
  plaintext: string
}

export function useCreateApiToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      workspaceId: string
      name: string
    }): Promise<CreateApiTokenResult> => {
      const secret = qc.getQueryData<string | null>(['admin-secret'])
      if (!secret) {
        throw new Error(
          'Admin secret not configured. Open Settings → Public API and enter it first.',
        )
      }
      const res = await createApiTokenServerFn({
        data: {
          auth: secret,
          workspaceId: input.workspaceId,
          name: input.name,
        },
      })
      const meta: ApiTokenMeta = {
        id: res.token.id,
        workspaceId: res.token.workspaceId,
        name: res.token.name,
        last4: res.token.last4,
        createdAt: res.token.createdAt,
        revoked: false,
      }
      const next = await addApiToken(meta)
      qc.setQueryData(apiTokensMetaKey, next)
      return { meta, plaintext: res.token.plaintext }
    },
  })
}

export function useRevokeApiToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const secret = qc.getQueryData<string | null>(['admin-secret'])
      if (!secret) {
        throw new Error('Admin secret not configured.')
      }
      await revokeApiTokenServerFn({ data: { auth: secret, tokenId: id } })
      const next = await markTokenRevoked(id)
      qc.setQueryData(apiTokensMetaKey, next)
    },
  })
}

export function useForgetApiTokenMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const next = await forgetApiToken(id)
      qc.setQueryData(apiTokensMetaKey, next)
    },
  })
}

/**
 * Reconcile local metadata against the server's authoritative list.
 * Pulled when returning to Settings so newly-revoked tokens are picked
 * up.
 */
export function useReconcileApiTokens(enabled: boolean) {
  const qc = useQueryClient()
  return useQuery({
    enabled,
    queryKey: ['api-tokens-reconcile'] as const,
    queryFn: async () => {
      const secret = qc.getQueryData<string | null>(['admin-secret'])
      if (!secret) throw new Error('Admin secret not configured.')
      const res = await listApiTokensServerFn({ data: { auth: secret } })
      const serverById = new Map(res.tokens.map((t) => [t.id, t]))
      const local = qc.getQueryData<ApiTokenMeta[]>(apiTokensMetaKey) ?? []
      const merged: ApiTokenMeta[] = local.map((m) => {
        const s = serverById.get(m.id)
        return s
          ? { ...m, revoked: s.revokedAt != null }
          : m
      })
      await setApiTokens(merged)
      qc.setQueryData(apiTokensMetaKey, merged)
      return merged
    },
  })
}
