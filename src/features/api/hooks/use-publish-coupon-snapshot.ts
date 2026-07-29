/**
 * Mutation: publish the browser's just-fetched coupon list to Netlify
 * Blobs so the public `/api/discount-codes` endpoint can serve it.
 *
 * Called after every successful Refresh in the manager UI. If the
 * admin secret isn't configured or the publish fails, we still keep
 * the local IndexedDB cache — only the public mirror becomes stale.
 */
import { useMutation } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { publishCouponsSnapshotServerFn } from '#/server/snapshot-publish'
import type {
  DiscountCode,
  DiscountEnvironment,
} from '#/features/stripe/types/discount-code'

function toSnapshotCoupon(c: DiscountCode) {
  return {
    id: c.id,
    couponId: c.couponId,
    code: c.code,
    name: c.name,
    discount: {
      type: c.discountType,
      percentOff: c.percentOff,
      amountOff: c.amountOff,
      currency: c.currency,
    },
    duration: c.duration,
    durationMonths: c.durationMonths,
    maxRedemptions: c.maxRedemptions,
    timesRedeemed: c.timesRedeemed,
    redeemBy: c.redeemBy ?? null,
    active: c.active,
    createdAt: c.createdAt,
    stripe: {
      checkout_integration: {
        discounts: [{ promotion_code: c.id }],
      },
    },
  }
}

export type PublishResult =
  | { ok: true; publishedAt: string }
  | { ok: false; reason: 'no-secret' | 'error'; error: string }

export function usePublishCouponSnapshot() {
  const qc = useQueryClient()
  return useMutation<PublishResult, Error, {
    workspaceId: string
    workspaceName: string
    environment: DiscountEnvironment
    codes: DiscountCode[]
    fetchedAt: string
  }>({
    mutationFn: async (input) => {
      const secret = qc.getQueryData<string | null>(['admin-secret'])
      if (!secret) {
        return {
          ok: false,
          reason: 'no-secret' as const,
          error:
            'Admin secret not configured. Tokens and snapshots are not being published.',
        }
      }
      try {
        const res = await publishCouponsSnapshotServerFn({
          data: {
            auth: secret,
            snapshot: {
              workspaceId: input.workspaceId,
              workspaceName: input.workspaceName,
              environment: input.environment,
              fetchedAt: input.fetchedAt,
              publishedAt: new Date().toISOString(),
              coupons: input.codes.map(toSnapshotCoupon),
            },
          },
        })
        return { ok: true as const, publishedAt: res.publishedAt }
      } catch (err) {
        return {
          ok: false,
          reason: 'error' as const,
          error: err instanceof Error ? err.message : 'Publish failed.',
        }
      }
    },
  })
}
