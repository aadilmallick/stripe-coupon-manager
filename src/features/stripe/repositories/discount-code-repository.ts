/**
 * DiscountCode repository.
 *
 * Owns the mapping between Stripe's two-stage model:
 *
 *     Stripe Coupon (settings)
 *            ↓
 *     Stripe Promotion Code (the user-facing string + active flag)
 *            ↓
 *     DiscountCode (internal domain)
 *
 * UI never sees `stripeCoupon` or `stripePromotionCode` — those are kept
 * inside this layer.
 */
import { z } from 'zod'
import type { DiscountCode } from '#/features/stripe/types/discount-code'
import type { DiscountEnvironment } from '#/features/stripe/types/discount-code'
import type {
  CreateDiscountCodeInput,
} from '#/features/stripe/types/discount-code'
import {
  StripeApiError,
  createStripeClient,
  listAll,
  type StripeClient,
} from '#/features/stripe/api/client'
import {
  StripeCouponSchema,
  StripePromoCodeListSchema,
  StripePromotionCodeSchema,
  StripeAccountSummarySchema,
} from '#/features/stripe/schemas/discount-code'

type StripeCouponRaw = z.infer<typeof StripeCouponSchema>
type StripePromotionCodeRaw = z.infer<typeof StripePromotionCodeSchema>

/**
 * Strip "expand[]=" keys for parsing — Stripe's expand transforms objects
 * into inline data, which our Zod schemas already accept.
 */
function mapPromotionCode(
  promo: StripePromotionCodeRaw,
  coupon: StripeCouponRaw,
  environment: DiscountEnvironment,
): DiscountCode {
  return {
    id: promo.id,
    couponId: coupon.id,
    code: promo.code,
    name: coupon.name ?? promo.code,
    environment,
    discountType: coupon.percent_off != null ? 'percent' : 'amount',
    percentOff: coupon.percent_off ?? undefined,
    amountOff: coupon.amount_off ?? undefined,
    currency: coupon.currency ?? undefined,
    duration: coupon.duration,
    durationMonths: coupon.duration_in_months ?? undefined,
    maxRedemptions:
      coupon.max_redemptions ?? promo.max_redemptions ?? undefined,
    redeemBy:
      promo.expires_at != null
        ? new Date(promo.expires_at * 1000).toISOString()
        : coupon.redeem_by != null
          ? new Date(coupon.redeem_by * 1000).toISOString()
          : undefined,
    timesRedeemed: promo.times_redeemed ?? coupon.times_redeemed ?? 0,
    active: promo.active,
    createdAt: new Date(promo.created * 1000).toISOString(),
  }
}

export interface DiscountCodeRepositoryDeps {
  client?: StripeClient
}

export function createDiscountCodeRepository(
  deps: DiscountCodeRepositoryDeps = {},
) {
  const client = deps.client ?? createStripeClient()

  return {
    /**
     * List every promotion code for the current Stripe account.
     * The `expand[]=data.coupon` param inlines the underlying coupon so we
     * can map to `DiscountCode` without a second round-trip.
     */
    async list(env: DiscountEnvironment, apiKey: string, signal?: AbortSignal) {
      const baseParams = {
        active: undefined as undefined | true,
        'expand[]': ['data.coupon'],
      }
      // We want all promotion codes (active and inactive) so users can
      // deactivate/reactivate. UI filters further if the user wants.
      const rows = (await listAll(
        client,
        '/promotion_codes',
        apiKey,
        baseParams,
        StripePromoCodeListSchema,
        signal,
      )) as Array<StripePromotionCodeRaw>
      return rows.map((promo) =>
        mapPromotionCode(promo, promo.coupon, env),
      )
    },

    async create(env: DiscountEnvironment, apiKey: string, input: CreateDiscountCodeInput) {
      // 1. Create the underlying coupon with sensible defaults.
      // We intentionally let the coupon stay unbounded so the same
      // coupon can be reused for future promotion codes. The cap and
      // expiry ride on the promotion code instead.
      const couponParams: Record<string, string | number | undefined> = {
        name: input.name,
        duration: input.duration,
        duration_in_months:
          input.duration === 'repeating' ? input.durationMonths : undefined,
        currency: input.discountType === 'amount' ? (input.currency ?? 'usd') : undefined,
        amount_off: input.discountType === 'amount' ? Math.round(input.value * 100) : undefined,
        percent_off: input.discountType === 'percent' ? input.value : undefined,
      }
      const coupon = await client.post(
        '/coupons',
        { apiKey, params: couponParams },
        StripeCouponSchema,
      )

      // 2. Create the promotion code that surfaces to customers.
      // Cap is set on the promotion code only — the coupon itself is
      // unbounded so future promotion codes can reuse the same settings.
      const promoParams: Record<string, string | number | undefined> = {
        coupon: coupon.id,
        code: input.code,
        active: 'true',
        max_redemptions: input.maxRedemptions,
        expires_at: input.redeemBy
          ? Math.floor(new Date(input.redeemBy).getTime() / 1000)
          : undefined,
      }
      const promo = await client.post(
        '/promotion_codes',
        {
          apiKey,
          // include coupon inline so mapping is consistent
          params: { ...promoParams, 'expand[]': ['coupon'] },
        },
        StripePromotionCodeSchema,
      )
      return mapPromotionCode(promo, promo.coupon, env)
    },

    /**
     * Delete = try to delete the coupon. Stripe refuses if it has been
     * redeemed even once; in that case we first deactivate the
     * promotion code, then attempt deletion (and surface a graceful
     * error if it still fails).
     */
    async remove(promoId: string, couponId: string, apiKey: string) {
      // 1. Deactivate the promotion code (always allowed).
      await client.post(
        `/promotion_codes/${encodeURIComponent(promoId)}`,
        { apiKey, params: { active: 'false' } },
        StripePromotionCodeSchema,
      )

      // 2. Attempt coupon deletion.
      try {
        await client.delete(
          `/coupons/${encodeURIComponent(couponId)}`,
          { apiKey },
          StripeCouponSchema,
        )
        return { codeDeleted: true, couponDeleted: true } as const
      } catch (err) {
        if (
          err instanceof StripeApiError &&
          err.code === 'resource_already_used'
        ) {
          return {
            codeDeleted: true,
            couponDeleted: false,
            message:
              'This discount code has already been used. The promotion code has been deactivated, but Stripe does not allow deleting coupons that have already been redeemed.',
          } as const
        }
        throw err
      }
    },

    /** Lightweight key validation — fetch the connected account id. */
    async validateKey(apiKey: string, signal?: AbortSignal) {
      const account = await client.get(
        '/account',
        { apiKey, signal },
        StripeAccountSummarySchema,
      )
      return {
        accountId: account.id,
        displayName:
          account.settings?.dashboard?.display_name ??
          account.business_profile?.name ??
          account.id,
      }
    },
  }
}

export const discountCodeRepository = createDiscountCodeRepository()
