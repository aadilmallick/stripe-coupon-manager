/**
 * Shared Zod schemas + TS types for the server-side token + snapshot
 * machinery. These are the contracts the public REST endpoint and the
 * admin RPCs funnel through.
 */
import { z } from 'zod'

/**
 * One coupon in the public-facing snapshot. Intentionally Stripe-Checkout
 * shaped so consumers can drop the value into `discounts[]` without
 * extra mapping.
 */
export const DiscountSnapshotCouponSchema = z.object({
  /** Stripe Promotion Code id (use this with Stripe Checkout). */
  id: z.string(),
  /** Stripe Coupon id (kept for parity / debugging). */
  couponId: z.string(),
  code: z.string(),
  name: z.string(),
  discount: z.object({
    type: z.enum(['percent', 'amount']),
    percentOff: z.number().int().min(1).max(100).optional(),
    amountOff: z.number().int().min(1).optional(),
    currency: z.string().length(3).optional(),
  }),
  duration: z.enum(['once', 'forever', 'repeating']),
  durationMonths: z.number().int().min(1).max(120).optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  timesRedeemed: z.number().int().min(0),
  /** Optional ISO timestamp — null when the code never expires. */
  redeemBy: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  /**
   * The literal payload the consumer should pass to Stripe Checkout.
   * Drives the integration DX.
   */
  stripe: z.object({
    checkout_integration: z.object({
      discounts: z
        .array(z.object({ promotion_code: z.string().min(1) }))
        .min(1)
        .max(1),
    }),
  }),
})

export type DiscountSnapshotCoupon = z.infer<
  typeof DiscountSnapshotCouponSchema
>

/**
 * Per-(workspace, environment) snapshot published from the browser.
 */
export const CouponSnapshotSchema = z.object({
  workspaceId: z.string().min(1),
  workspaceName: z.string().min(1),
  environment: z.enum(['test', 'live']),
  /** When the browser last refreshed from Stripe. */
  fetchedAt: z.string(),
  /** When this snapshot was published. */
  publishedAt: z.string(),
  coupons: z.array(DiscountSnapshotCouponSchema).max(500),
})

export type CouponSnapshot = z.infer<typeof CouponSnapshotSchema>

/**
 * Server-side record for an API token. The plaintext token is never
 * stored here — only its SHA-256 hash.
 */
export const ApiTokenRecordSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1).max(80),
  /** Hex SHA-256 of the plaintext token. */
  tokenHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string(),
  revokedAt: z.string().optional(),
})

export type ApiTokenRecord = z.infer<typeof ApiTokenRecordSchema>

/** Public-facing metadata (no secrets here). */
export interface ApiTokenMeta {
  id: string
  workspaceId: string
  name: string
  last4: string
  createdAt: string
  revoked: boolean
}
