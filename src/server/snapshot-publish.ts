/**
 * Server function that the browser calls after every successful Refresh
 * to mirror the live coupon snapshot into Netlify Blobs. This snapshot
 * is what the public `/api/discount-codes` endpoint reads from.
 *
 * Stripe secret keys never reach this function — the snapshot already
 * contains everything an external consumer needs.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { CouponSnapshotSchema } from './types'
import { writeSnapshot } from './blob-store'

const PublishSchema = z.object({
  auth: z.string().min(8),
  snapshot: CouponSnapshotSchema,
})

export const publishCouponsSnapshotServerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => PublishSchema.parse(d))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PUBLISH_SECRET?.trim()
    if (!expected || data.auth !== expected) {
      throw new Error('Unauthorized.')
    }
    const publishedAt = new Date().toISOString()
    await writeSnapshot({
      ...data.snapshot,
      publishedAt,
    })
    return { ok: true as const, publishedAt }
  })
