/**
 * IndexedDB-backed admin secret.
 *
 * Stored only because the user wants a one-time setup. Lives in
 * IndexedDB alongside other local state — never sent anywhere except
 * to the same project's own server functions.
 *
 * Rotating the secret: update the Netlify env var, then change it here
 * via the Settings UI.
 */
import { storage } from './localforage-instance'

const KEY = 'adminSecret.v1'

export async function loadAdminSecret(): Promise<string | null> {
  return (await storage.getItem<string>(KEY)) ?? null
}

export async function saveAdminSecret(secret: string): Promise<void> {
  await storage.setItem(KEY, secret)
}

export async function clearAdminSecret(): Promise<void> {
  await storage.removeItem(KEY)
}
