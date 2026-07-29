import { z } from 'zod'
import { DiscountEnvironmentSchema } from './discount-code'

export const StripeApiKeySchema = z
  .string()
  .trim()
  .regex(
    /^sk_(test|live)_[A-Za-z0-9]{16,}$/,
    'Looks like a Stripe secret key (sk_test_… or sk_live_…)',
  )

export const StripeWorkspaceFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(48, 'Name must be 48 characters or fewer'),
  description: z
    .string()
    .max(280, 'Keep description to 280 characters or fewer')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  testKey: StripeApiKeySchema.optional().or(z.literal('').transform(() => undefined)),
  liveKey: StripeApiKeySchema.optional().or(z.literal('').transform(() => undefined)),
})

export type StripeWorkspaceFormValues = z.infer<typeof StripeWorkspaceFormSchema>

export const PreferencesSchema = z.object({
  selectedWorkspaceId: z.string().nullable(),
  selectedEnvironment: DiscountEnvironmentSchema,
  showOnlyActive: z.boolean(),
})
export type Preferences = z.infer<typeof PreferencesSchema>
