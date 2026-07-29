import { z } from 'zod'

export const DiscountEnvironmentSchema = z.enum(['test', 'live'])
export const DiscountTypeSchema = z.enum(['percent', 'amount'])
export const DiscountDurationSchema = z.enum(['once', 'forever', 'repeating'])

export const CurrencySchema = z
  .string()
  .length(3, 'Currency must be a 3-letter ISO code')
  .regex(/^[a-z]{3}$/i, 'Currency must be lowercase 3-letter ISO code')

/**
 * Form schema. Coerces the "value" field (string from inputs) to a number.
 */
export const CreateDiscountCodeFormSchema = z
  .object({
    code: z
      .string()
      .min(3, 'Code must be at least 3 characters')
      .max(64, 'Code must be 64 characters or fewer')
      .regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, dashes and underscores only'),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(64, 'Name must be 64 characters or fewer'),
    discountType: DiscountTypeSchema,
    value: z.coerce
      .number({ message: 'Enter a numeric value' })
      .positive('Value must be positive'),
    duration: DiscountDurationSchema,
    durationMonths: z.coerce.number().int().positive().optional(),
    maxRedemptions: z.coerce.number().int().positive().optional(),
    redeemBy: z.string().optional(),
    currency: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z]{3}$/, 'Currency must be a 3-letter ISO code')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === 'percent' && data.value > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Percentage cannot exceed 100',
      })
    }
    if (data.duration === 'repeating' && !data.durationMonths) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMonths'],
        message: 'Duration in months is required for repeating coupons',
      })
    }
    if (data.discountType === 'amount' && !data.currency) {
      ctx.addIssue({
        code: 'custom',
        path: ['currency'],
        message: 'Currency is required for fixed amount coupons',
      })
    }
  })

export type CreateDiscountCodeFormValues = z.infer<
  typeof CreateDiscountCodeFormSchema
>

/**
 * Stripe Coupons + Promotion Codes raw response schemas.
 * We validate every Stripe response before mapping to the domain model.
 */
export const StripeCouponSchema = z.object({
  id: z.string(),
  object: z.literal('coupon').optional(),
  name: z.string().nullable().optional(),
  percent_off: z.number().nullable().optional(),
  amount_off: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  duration: z.enum(['once', 'forever', 'repeating']),
  duration_in_months: z.number().nullable().optional(),
  max_redemptions: z.number().nullable().optional(),
  redeem_by: z.number().nullable().optional(),
  times_redeemed: z.number().default(0),
  valid: z.boolean().optional(),
  created: z.number(),
})

export const StripePromotionCodeSchema = z.object({
  id: z.string(),
  object: z.literal('promotion_code').optional(),
  code: z.string(),
  active: z.boolean(),
  coupon: StripeCouponSchema,
  created: z.number(),
  expires_at: z.number().nullable().optional(),
  max_redemptions: z.number().nullable().optional(),
  times_redeemed: z.number().default(0),
  restrictions: z
    .object({
      first_time_transaction: z.boolean().optional(),
      minimum_amount: z.number().nullable().optional(),
      minimum_amount_currency: z.string().nullable().optional(),
    })
    .optional(),
})

export const StripeListSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    object: z.literal('list').optional(),
    data: z.array(item),
    has_more: z.boolean().default(false),
    url: z.string().optional(),
  })

export const StripePromoCodeListSchema = StripeListSchema(
  StripePromotionCodeSchema,
)

export const StripeAccountSummarySchema = z.object({
  object: z.literal('account').optional(),
  id: z.string(),
  business_profile: z.object({ name: z.string().nullable().optional() }).optional(),
  settings: z.object({ dashboard: z.object({ display_name: z.string().nullable().optional() }).optional() }).optional(),
})
