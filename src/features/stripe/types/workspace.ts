/**
 * A "workspace" represents a logical grouping of Stripe API keys for a
 * single account (say, "My SaaS" or "Client A"). Each workspace can
 * hold a Test key and/or a Live key.
 */
import type { DiscountEnvironment } from './discount-code'

export interface StripeWorkspace {
  id: string
  name: string
  /** Optional free-form description that gets included when sharing the workspace by email. */
  description?: string
  testKey?: string
  liveKey?: string
  createdAt: string
  updatedAt: string
}

export type { DiscountEnvironment }
