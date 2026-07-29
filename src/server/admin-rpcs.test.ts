/**
 * Tests for the admin RPC handlers.
 *
 * Each handler is a pure function that runs Zod validation, the
 * admin-secret guard, and storage operations. We exercise the handlers
 * directly so test runs do not need the TanStack Start runtime.
 *
 * The same `vi.mock + vi.hoisted` pattern as the public endpoint test
 * is used to swap the JsonStore for in-memory stubs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'super-secret-admin-string-12345'

/* -------------------------------------------------------------------------- */
/*                            Stubbed storage                                 */
/* -------------------------------------------------------------------------- */

const stubs = vi.hoisted(() => {
  // Names end in `Map` so test code can't accidentally call
  // `.get()` directly on the Map (which would return `undefined`).
  const tokensMap = new Map<string, unknown>()
  const snapshotsMap = new Map<string, unknown>()
  return { tokensMap, snapshotsMap }
})

function stubStore(map: Map<string, unknown>) {
  return {
    async get<T>(key: string) {
      return (map.get(key) ?? null) as T | null
    },
    async set<T>(key: string, value: T) {
      map.set(key, value)
    },
    async delete(key: string) {
      map.delete(key)
    },
    async list() {
      return Array.from(map.keys())
    },
  }
}

vi.mock('#/server/storage', async () => {
  const actual =
    await vi.importActual<typeof import('#/server/storage')>(
      '#/server/storage',
    )
  return {
    ...actual,
    getTokensStore: () => Promise.resolve(stubStore(stubs.tokensMap)),
    getSnapshotsStore: () => Promise.resolve(stubStore(stubs.snapshotsMap)),
  }
})

/* -------------------------------------------------------------------------- */
/*                                Imports                                      */
/* -------------------------------------------------------------------------- */

import { z } from 'zod'
import {
  createApiTokenHandler,
  listApiTokensHandler,
  requireAdminSecret,
  revokeApiTokenHandler,
} from './api-tokens'
import { publishCouponSnapshotHandler } from './snapshot-publish'
import { sha256Hex } from '#/server/storage'
import { CouponSnapshotSchema, type ApiTokenRecord } from './types'

type CouponSnapshot = z.infer<typeof CouponSnapshotSchema>
type SnapshotOverrides = Partial<{
  workspaceId: string
  workspaceName: string
  environment: 'test' | 'live'
  fetchedAt: string
  publishedAt: string
  coupons: CouponSnapshot['coupons']
}>

const ALL_TOKENS_KEY = '__all_tokens__'

/* -------------------------------------------------------------------------- */
/*                                Helpers                                      */
/* -------------------------------------------------------------------------- */

async function readAllTokens(): Promise<ApiTokenRecord[]> {
  return ((await stubs.tokensMap.get(ALL_TOKENS_KEY)) as ApiTokenRecord[] | null) ?? []
}

async function seedToken(record: ApiTokenRecord): Promise<void> {
  const all = await readAllTokens()
  await stubs.tokensMap.set(ALL_TOKENS_KEY, [...all, record])
}

function sampleSnapshot(overrides: SnapshotOverrides = {}): CouponSnapshot {
  const base: CouponSnapshot = {
    workspaceId: 'ws_alpha',
    workspaceName: 'Test workspace',
    environment: 'test',
    fetchedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    coupons: [
      {
        id: 'promo_123',
        couponId: 'co_456',
        code: 'SUMMER25',
        name: 'Summer 25%',
        discount: { type: 'percent', percentOff: 25 },
        duration: 'once',
        timesRedeemed: 0,
        redeemBy: null,
        active: true,
        createdAt: new Date().toISOString(),
        stripe: {
          checkout_integration: {
            discounts: [{ promotion_code: 'promo_123' }],
          },
        },
      },
    ],
  }
  return CouponSnapshotSchema.parse({ ...base, ...overrides })
}

beforeEach(() => {
  stubs.tokensMap.clear()
  stubs.snapshotsMap.clear()
  process.env.ADMIN_PUBLISH_SECRET = SECRET
})

/* -------------------------------------------------------------------------- */
/*                              requireAdminSecret                             */
/* -------------------------------------------------------------------------- */

describe('requireAdminSecret', () => {
  it('throws when the env var is not set', () => {
    delete process.env.ADMIN_PUBLISH_SECRET
    expect(() => requireAdminSecret(SECRET)).toThrow(
      /ADMIN_PUBLISH_SECRET is not configured/i,
    )
  })

  it('throws when the input auth does not match', () => {
    expect(() => requireAdminSecret('wrong-secret-still')).toThrow(
      /Unauthorized/,
    )
  })

  it('does not throw when the input auth matches', () => {
    expect(() => requireAdminSecret(SECRET)).not.toThrow()
  })
})

/* -------------------------------------------------------------------------- */
/*                              createApiTokenHandler                          */
/* -------------------------------------------------------------------------- */

describe('createApiTokenHandler', () => {
  it('rejects when auth is wrong', async () => {
    await expect(
      createApiTokenHandler({
        auth: 'wrong-secret-still',
        workspaceId: 'ws_1',
        name: 'Token',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })

  it('rejects when the env var is unset', async () => {
    delete process.env.ADMIN_PUBLISH_SECRET
    await expect(
      createApiTokenHandler({ auth: SECRET, workspaceId: 'ws_1', name: 'T' }),
    ).rejects.toThrow(/not configured/i)
  })

  it('returns a token with the expected shape', async () => {
    const res = await createApiTokenHandler({
      auth: SECRET,
      workspaceId: 'ws_alpha',
      name: 'Production checkout',
    })
    expect(res.ok).toBe(true)
    expect(res.token.id).toMatch(/^tok_/)
    expect(res.token.plaintext).toMatch(/^dcm_[A-Za-z0-9_-]+$/)
    expect(res.token.last4).toBe(res.token.plaintext.slice(-4))
    expect(res.token.workspaceId).toBe('ws_alpha')
    expect(res.token.name).toBe('Production checkout')
    expect(Number.isFinite(Date.parse(res.token.createdAt))).toBe(true)
  })

  it('stores the SHA-256 hash of the plaintext, never the plaintext', async () => {
    const res = await createApiTokenHandler({
      auth: SECRET,
      workspaceId: 'ws_alpha',
      name: 'T',
    })
    const all = await readAllTokens()
    expect(all).toHaveLength(1)
    const record = all[0]
    expect(record.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(record.tokenHash).toBe(sha256Hex(res.token.plaintext))
    expect(record.tokenHash).not.toContain('dcm_')
    expect(record.workspaceId).toBe('ws_alpha')
    expect(record.name).toBe('T')
    expect(record.revokedAt).toBeUndefined()
  })

  it('yields unique id + plaintext for back-to-back calls', async () => {
    const a = await createApiTokenHandler({
      auth: SECRET,
      workspaceId: 'ws_1',
      name: 'A',
    })
    const b = await createApiTokenHandler({
      auth: SECRET,
      workspaceId: 'ws_1',
      name: 'B',
    })
    expect(a.token.id).not.toBe(b.token.id)
    expect(a.token.plaintext).not.toBe(b.token.plaintext)
  })

  it('rejects when name is empty', async () => {
    await expect(
      createApiTokenHandler({
        auth: SECRET,
        workspaceId: 'ws_1',
        name: '',
      }),
    ).rejects.toThrow()
  })

  it('rejects when workspaceId is empty', async () => {
    await expect(
      createApiTokenHandler({
        auth: SECRET,
        workspaceId: '',
        name: 'T',
      }),
    ).rejects.toThrow()
  })

  it('rejects when auth is too short', async () => {
    await expect(
      createApiTokenHandler({
        auth: 'short',
        workspaceId: 'ws_1',
        name: 'T',
      }),
    ).rejects.toThrow()
  })
})

/* -------------------------------------------------------------------------- */
/*                              revokeApiTokenHandler                          */
/* -------------------------------------------------------------------------- */

describe('revokeApiTokenHandler', () => {
  it('rejects when auth is wrong', async () => {
    await expect(
      revokeApiTokenHandler({
        auth: 'wrong-secret-still',
        tokenId: 'tok_x',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })

  it('throws when the token id does not exist', async () => {
    await expect(
      revokeApiTokenHandler({ auth: SECRET, tokenId: 'tok_missing' }),
    ).rejects.toThrow(/Token not found/i)
  })

  it('marks the token as revoked and sets revokedAt', async () => {
    await seedToken({
      id: 'tok_1',
      workspaceId: 'ws_alpha',
      name: 'T',
      tokenHash: sha256Hex('dcm_xyz'),
      createdAt: '2024-01-01T00:00:00.000Z',
    })
    const res = await revokeApiTokenHandler({ auth: SECRET, tokenId: 'tok_1' })
    expect(res.ok).toBe(true)
    expect(Number.isFinite(Date.parse(res.revokedAt))).toBe(true)
    const all = await readAllTokens()
    expect(all[0].revokedAt).toBe(res.revokedAt)
  })

  it('overwrites a previously set revokedAt timestamp', async () => {
    await seedToken({
      id: 'tok_2',
      workspaceId: 'ws_alpha',
      name: 'T',
      tokenHash: sha256Hex('dcm_xyz'),
      createdAt: '2024-01-01T00:00:00.000Z',
      revokedAt: '2024-01-02T00:00:00.000Z',
    })
    const res = await revokeApiTokenHandler({ auth: SECRET, tokenId: 'tok_2' })
    expect(res.ok).toBe(true)
    expect(res.revokedAt).not.toBe('2024-01-02T00:00:00.000Z')
  })
})

/* -------------------------------------------------------------------------- */
/*                              listApiTokensHandler                           */
/* -------------------------------------------------------------------------- */

describe('listApiTokensHandler', () => {
  it('rejects when auth is wrong', async () => {
    await expect(
      listApiTokensHandler({ auth: 'wrong-secret-still' }),
    ).rejects.toThrow(/Unauthorized/)
  })

  it('returns an empty list when no tokens are stored', async () => {
    const res = await listApiTokensHandler({ auth: SECRET })
    expect(res.ok).toBe(true)
    expect(res.tokens).toEqual([])
  })

  it('returns all tokens (active + revoked) with sanitized shape', async () => {
    await seedToken({
      id: 'tok_active',
      workspaceId: 'ws_alpha',
      name: 'Active',
      tokenHash: sha256Hex('dcm_active'),
      createdAt: '2024-01-01T00:00:00.000Z',
    })
    await seedToken({
      id: 'tok_revoked',
      workspaceId: 'ws_beta',
      name: 'Revoked',
      tokenHash: sha256Hex('dcm_revoked'),
      createdAt: '2024-01-01T00:00:00.000Z',
      revokedAt: '2024-01-02T00:00:00.000Z',
    })
    const res = await listApiTokensHandler({ auth: SECRET })
    expect(res.ok).toBe(true)
    expect(res.tokens).toHaveLength(2)
    for (const t of res.tokens) {
      expect(typeof t.id).toBe('string')
      expect(typeof t.workspaceId).toBe('string')
      expect(typeof t.name).toBe('string')
      expect(typeof t.createdAt).toBe('string')
      expect(t.revokedAt === null || typeof t.revokedAt === 'string').toBe(true)
      expect(t).not.toHaveProperty('tokenHash')
      expect(t).not.toHaveProperty('plaintext')
      expect(t).not.toHaveProperty('last4')
    }
    const revoked = res.tokens.find((t) => t.id === 'tok_revoked')
    expect(revoked?.revokedAt).toBe('2024-01-02T00:00:00.000Z')
  })
})

/* -------------------------------------------------------------------------- */
/*                         publishCouponSnapshotHandler                        */
/* -------------------------------------------------------------------------- */

describe('publishCouponSnapshotHandler', () => {
  it('rejects when auth is wrong', async () => {
    await expect(
      publishCouponSnapshotHandler({
        auth: 'wrong-secret-still',
        snapshot: sampleSnapshot(),
      }),
    ).rejects.toThrow(/Unauthorized/)
  })

  it('rejects when the env var is unset', async () => {
    delete process.env.ADMIN_PUBLISH_SECRET
    await expect(
      publishCouponSnapshotHandler({
        auth: SECRET,
        snapshot: sampleSnapshot(),
      }),
    ).rejects.toThrow(/Unauthorized/)
  })

  it('writes the snapshot to the right key and returns publishedAt', async () => {
    const snapshot = sampleSnapshot({
      workspaceId: 'ws_xyz',
      environment: 'live',
    })
    const res = await publishCouponSnapshotHandler({
      auth: SECRET,
      snapshot,
    })
    expect(res.ok).toBe(true)
    expect(Number.isFinite(Date.parse(res.publishedAt))).toBe(true)
    const stored = (await stubs.snapshotsMap.get('ws_xyz__live')) as CouponSnapshot | null
    expect(stored).not.toBeNull()
    expect(stored?.workspaceId).toBe('ws_xyz')
    expect(stored?.environment).toBe('live')
    expect(stored?.publishedAt).toBe(res.publishedAt)
    expect(stored?.coupons[0].code).toBe('SUMMER25')
  })

  it('overwrites any existing snapshot for the same (workspace, environment)', async () => {
    await publishCouponSnapshotHandler({
      auth: SECRET,
      snapshot: sampleSnapshot({ workspaceId: 'ws_xyz', environment: 'test' }),
    })
    const second = await publishCouponSnapshotHandler({
      auth: SECRET,
      snapshot: sampleSnapshot({
        workspaceId: 'ws_xyz',
        environment: 'test',
        workspaceName: 'Updated name',
      }),
    })
    const stored = (await stubs.snapshotsMap.get('ws_xyz__test')) as CouponSnapshot | null
    expect(stored?.workspaceName).toBe('Updated name')
    expect(stored?.publishedAt).toBe(second.publishedAt)
  })

  it('keeps keys separated by workspace and environment', async () => {
    await publishCouponSnapshotHandler({
      auth: SECRET,
      snapshot: sampleSnapshot({ workspaceId: 'ws_1', environment: 'test' }),
    })
    await publishCouponSnapshotHandler({
      auth: SECRET,
      snapshot: sampleSnapshot({ workspaceId: 'ws_1', environment: 'live' }),
    })
    await publishCouponSnapshotHandler({
      auth: SECRET,
      snapshot: sampleSnapshot({ workspaceId: 'ws_2', environment: 'test' }),
    })
    expect(stubs.snapshotsMap.has('ws_1__test')).toBe(true)
    expect(stubs.snapshotsMap.has('ws_1__live')).toBe(true)
    expect(stubs.snapshotsMap.has('ws_2__test')).toBe(true)
    expect(stubs.snapshotsMap.has('ws_2__live')).toBe(false)
    expect(stubs.snapshotsMap.size).toBe(3)
  })

  it('rejects snapshots that fail Zod validation', async () => {
    await expect(
      publishCouponSnapshotHandler({
        auth: SECRET,
        snapshot: { workspaceId: 'ws_1' },
      }),
    ).rejects.toThrow()
  })
})
