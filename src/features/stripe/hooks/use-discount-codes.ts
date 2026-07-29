import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { discountCodeRepository } from '#/features/stripe/repositories/discount-code-repository'
import type {
  CreateDiscountCodeInput,
  DiscountCode,
} from '#/features/stripe/types/discount-code'
import type { SelectedWorkspaceContext } from './use-current-selection'

export function discountCodesKey(workspaceId: string, environment: string) {
  return ['discount-codes', workspaceId, environment] as const
}

export function keyValidationKey(workspaceId: string, environment: string) {
  return ['key-validation', workspaceId, environment] as const
}

export function useDiscountCodes(ctx: SelectedWorkspaceContext | null) {
  return useQuery<DiscountCode[]>({
    queryKey: ctx
      ? discountCodesKey(ctx.workspace.id, ctx.environment)
      : ['discount-codes', 'idle'],
    queryFn: ({ signal }) => {
      if (!ctx) throw new Error('No active workspace')
      return discountCodeRepository.list(ctx.environment, ctx.apiKey, signal)
    },
    enabled: Boolean(ctx),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateDiscountCode(ctx: SelectedWorkspaceContext | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateDiscountCodeInput) => {
      if (!ctx) throw new Error('No active workspace')
      return discountCodeRepository.create(ctx.environment, ctx.apiKey, input)
    },
    onSuccess: (created) => {
      if (!ctx) return
      qc.setQueryData<DiscountCode[]>(
        discountCodesKey(ctx.workspace.id, ctx.environment),
        (prev) => (prev ? [created, ...prev] : [created]),
      )
    },
  })
}

export interface DeleteResult {
  codeDeleted: boolean
  couponDeleted: boolean
  message?: string
}

export function useDeleteDiscountCode(ctx: SelectedWorkspaceContext | null) {
  const qc = useQueryClient()
  return useMutation<DeleteResult, Error, { id: string; couponId: string }>({
    mutationFn: async (vars) => {
      if (!ctx) throw new Error('No active workspace')
      return discountCodeRepository.remove(
        vars.id,
        vars.couponId,
        ctx.apiKey,
      )
    },
    onSuccess: (_result, vars) => {
      if (!ctx) return
      qc.setQueryData<DiscountCode[]>(
        discountCodesKey(ctx.workspace.id, ctx.environment),
        (prev) =>
          prev ? prev.filter((c) => c.id !== vars.id) : prev,
      )
    },
    onError: () => {
      // The promotion code is already deactivated server-side on Stripe;
      // even if the coupon deletion fails we should not leave stale UI.
      if (!ctx) return
      qc.invalidateQueries({
        queryKey: discountCodesKey(ctx.workspace.id, ctx.environment),
      })
    },
  })
}

/**
 * Validates that the selected API key actually works against Stripe.
 * Used for the empty-account state and after adding a key.
 */
export function useValidateKey(ctx: SelectedWorkspaceContext | null) {
  return useQuery({
    queryKey: ctx
      ? keyValidationKey(ctx.workspace.id, ctx.environment)
      : ['key-validation', 'idle'],
    queryFn: ({ signal }) => {
      if (!ctx) throw new Error('No active workspace')
      return discountCodeRepository.validateKey(ctx.apiKey, signal)
    },
    enabled: Boolean(ctx),
    staleTime: 5 * 60_000,
    retry: false,
  })
}


