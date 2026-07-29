/**
 * Domain operations on top of `src/server/storage.ts`.
 *
 * Tokens: stored as a single key per store (read-modify-write). Volume
 * is small (one record per issued token) so a scan on every public
 * request is fine for this personal-tool use case.
 *
 * Snapshots: keyed by `${workspaceId}__${environment}` for O(1) lookup
 * from the public endpoint.
 */
import type { ApiTokenRecord, CouponSnapshot } from './types'
import { getSnapshotsStore, getTokensStore } from './storage'

const ALL_TOKENS_KEY = '__all_tokens__'

/* -------------------------------------------------------------------------- */
/*                                    Tokens                                  */
/* -------------------------------------------------------------------------- */

async function readAllTokens(): Promise<ApiTokenRecord[]> {
  const store = await getTokensStore()
  return (await store.get<ApiTokenRecord[]>(ALL_TOKENS_KEY)) ?? []
}

async function writeAllTokens(list: ApiTokenRecord[]): Promise<void> {
  const store = await getTokensStore()
  await store.set(ALL_TOKENS_KEY, list)
}

export async function findTokenByHash(
  hash: string,
): Promise<ApiTokenRecord | null> {
  const all = await readAllTokens()
  return all.find((t) => t.tokenHash === hash && !t.revokedAt) ?? null
}

export async function listAllTokenRecords(): Promise<ApiTokenRecord[]> {
  return readAllTokens()
}

export async function createTokenRecord(input: {
  id: string
  workspaceId: string
  name: string
  tokenHash: string
}): Promise<ApiTokenRecord> {
  const all = await readAllTokens()
  const record: ApiTokenRecord = {
    ...input,
    name: input.name.trim(),
    createdAt: new Date().toISOString(),
  }
  await writeAllTokens([...all, record])
  return record
}

export async function revokeTokenRecord(
  id: string,
): Promise<ApiTokenRecord | null> {
  const all = await readAllTokens()
  const idx = all.findIndex((t) => t.id === id)
  if (idx < 0) return null
  const updated: ApiTokenRecord = {
    ...all[idx],
    revokedAt: new Date().toISOString(),
  }
  const next = all.slice()
  next[idx] = updated
  await writeAllTokens(next)
  return updated
}

/* -------------------------------------------------------------------------- */
/*                                  Snapshots                                 */
/* -------------------------------------------------------------------------- */

function snapshotKey(workspaceId: string, environment: string): string {
  return `${workspaceId}__${environment}`
}

export async function writeSnapshot(snapshot: CouponSnapshot): Promise<void> {
  const store = await getSnapshotsStore()
  await store.set(snapshotKey(snapshot.workspaceId, snapshot.environment), snapshot)
}

export async function readSnapshot(
  workspaceId: string,
  environment: string,
): Promise<CouponSnapshot | null> {
  const store = await getSnapshotsStore()
  return store.get<CouponSnapshot>(snapshotKey(workspaceId, environment))
}
