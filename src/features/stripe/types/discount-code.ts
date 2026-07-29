/**
 * Internal domain model. Never expose Stripe Coupon or PromotionCode
 * to the UI. Repository layer is responsible for translation.
 */
export type DiscountEnvironment = 'test' | 'live'

export type DiscountType = 'percent' | 'amount'

export type DiscountDuration = 'once' | 'forever' | 'repeating'

export interface DiscountCode {
  /** Unique identifier (we use Stripe promotion code id). */
  id: string
  /** Stripe coupon id (kept internally so we can delete the coupon). */
  couponId: string
  /** The user-facing code string, e.g. "SUMMER25". */
  code: string
  /** Human-friendly label for the coupon. */
  name: string
  environment: DiscountEnvironment
  discountType: DiscountType
  percentOff?: number
  amountOff?: number
  currency?: string
  duration: DiscountDuration
  durationMonths?: number
  maxRedemptions?: number
  redeemBy?: string
  timesRedeemed: number
  active: boolean
  createdAt: string
}

export interface CreateDiscountCodeInput {
  code: string
  name: string
  discountType: DiscountType
  value: number
  duration: DiscountDuration
  durationMonths?: number
  maxRedemptions?: number
  redeemBy?: string
  currency?: string
}

export type CreateDiscountCodeErrors = {
  fieldErrors?: Partial<Record<keyof CreateDiscountCodeInput, string>>
  formError?: string
}
