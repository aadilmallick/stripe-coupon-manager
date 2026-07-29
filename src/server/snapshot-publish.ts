/**
 * Server function that the browser calls after every successful Refresh
 * to mirror the live coupon snapshot into Netlify Blobs. This snapshot
 * is what the public `/api/discount-codes` endpoint reads from.
 *
 * Stripe secret keys never reach this function — the snapshot already
 * contains everything an external consumer needs.
 *
 * The handler accepts `unknown` and re-validates with the Zod schema so
 * the test suite can drive validation directly.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { CouponSnapshotSchema } from './types'
import { writeSnapshot } from './blob-store'

const PublishSchema = z.object({
  auth: z.string().min(8),
  snapshot: CouponSnapshotSchema,
})

export type PublishSnapshotInput = z.infer<typeof PublishSchema>

export async function publishCouponSnapshotHandler(
  input: unknown,
): Promise<{ ok: true; publishedAt: string }> {
  const data = PublishSchema.parse(input)
  const expected = process.env.ADMIN_PUBLISH_SECRET?.trim()
  if (!expected || data.auth !== expected) {
    throw new Error('Unauthorized.')
  }
  const publishedAt = new Date().toISOString()
  await writeSnapshot({
    ...data.snapshot,
    publishedAt,
  })
  return { ok: true, publishedAt }
}

export const publishCouponsSnapshotServerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => PublishSchema.parse(d))
  .handler(async ({ data }) => publishCouponSnapshotHandler(data))
