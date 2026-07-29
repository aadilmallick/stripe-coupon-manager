/**
 * IndexedDB-backed coupon snapshot cache.
 *
 * On every Stripe fetch we save the result here so the manager UI can
 * serve the previous result instantly on reload. The same snapshot is
 * mirrored to Netlify Blobs at the same time, so consumers of the
 * public API endpoint see consistent data.
 *
 * Note: this overrides the original "always fetch live" spec — but the
 *   user explicitly asked to keep a local copy in IndexedDB.
 */
import { storage } from './localforage-instance'
import type {
  DiscountCode,
  DiscountEnvironment,
} from '#/features/stripe/types/discount-code'

function key(workspaceId: string, environment: DiscountEnvironment): string {
  return `coupons.v1.${workspaceId}.${environment}`
}

export interface CachedCouponSet {
  fetchedAt: string
  codes: DiscountCode[]
}

export async function loadCachedCoupons(
  workspaceId: string,
  environment: DiscountEnvironment,
): Promise<CachedCouponSet | null> {
  const raw = (await storage.getItem<CachedCouponSet>(key(workspaceId, environment))) ?? null
  return raw
}

export async function saveCachedCoupons(
  workspaceId: string,
  environment: DiscountEnvironment,
  codes: DiscountCode[],
): Promise<CachedCouponSet> {
  const value: CachedCouponSet = {
    fetchedAt: new Date().toISOString(),
    codes,
  }
  await storage.setItem(key(workspaceId, environment), value)
  return value
}
