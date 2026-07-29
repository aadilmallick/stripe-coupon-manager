import localforage from 'localforage'

/**
 * Single localforage instance, central configuration.
 *
 * NOTE: We never store discount codes here — the spec is explicit that
 * Stripe data must always be fetched live. We only persist user-owned
 * state: workspaces, current selection, UI preferences.
 */

localforage.config({
  name: 'stripe-coupon-manager',
  description: 'Local state for the Stripe Coupon Manager',
  storeName: 'scm_v1',
})

export const storage = localforage
