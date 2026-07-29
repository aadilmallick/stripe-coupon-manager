/**
 * IndexedDB-backed API token metadata.
 *
 * The plaintext token is NEVER persisted here — it's shown exactly once
 * at creation. After that we only keep id/name/last4/createdAt/revoked
 * so the Settings page can show a list.
 */
import { storage } from './localforage-instance'
import type { ApiTokenMeta } from '#/server/types'

const KEY = 'apiTokens.v1'

export async function loadApiTokens(): Promise<ApiTokenMeta[]> {
  return (await storage.getItem<ApiTokenMeta[]>(KEY)) ?? []
}

export async function addApiToken(meta: ApiTokenMeta): Promise<ApiTokenMeta[]> {
  const list = await loadApiTokens()
  const next = [...list, meta]
  await storage.setItem(KEY, next)
  return next
}

export async function setApiTokens(list: ApiTokenMeta[]): Promise<ApiTokenMeta[]> {
  await storage.setItem(KEY, list)
  return list
}

export async function markTokenRevoked(id: string): Promise<ApiTokenMeta[]> {
  const list = await loadApiTokens()
  return setApiTokens(list.map((t) => (t.id === id ? { ...t, revoked: true } : t)))
}

export async function forgetApiToken(id: string): Promise<ApiTokenMeta[]> {
  const list = await loadApiTokens()
  return setApiTokens(list.filter((t) => t.id !== id))
}
