/**
 * Tests for the public `/api/discount-codes` endpoint.
 *
 * Strategy: stub the JsonStore layer behind `src/server/storage.ts` so
 * we exercise the real handler logic (header parsing, Zod validation,
 * token↔workspace binding, blob key shape) without making any local
 * Netlify runtime calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

/* -------------------------------------------------------------------------- */
/*                            Stubbed storage                                 */
/* -------------------------------------------------------------------------- */

const stubs = vi.hoisted(() => {
  const tokens = new Map<string, unknown>()
  const snapshots = new Map<string, unknown>()
  return { tokens, snapshots }
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
    getTokensStore: () => Promise.resolve(stubStore(stubs.tokens)),
    getSnapshotsStore: () => Promise.resolve(stubStore(stubs.snapshots)),
  }
})

/* -------------------------------------------------------------------------- */
/*                                Imports                                      */
/* -------------------------------------------------------------------------- */

import { handle } from './discount-codes'
import { sha256Hex } from '#/server/storage'
import type {
  ApiTokenRecord,
  CouponSnapshot,
} from '#/server/types'

const WORKSPACE_A = 'ws_alpha'
const WORKSPACE_B = 'ws_beta'

const ALL_TOKENS_KEY = '__all_tokens__'

/* -------------------------------------------------------------------------- */
/*                                Helpers                                      */
/* -------------------------------------------------------------------------- */

function makeRequest(args: {
  body?: unknown
  headers?: Record<string, string>
}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(args.headers ?? {}),
  }
  const init: RequestInit = { method: 'POST', headers }
  if (args.body !== undefined) {
    init.body =
      typeof args.body === 'string' ? args.body : JSON.stringify(args.body)
  }
  return new Request('http://localhost/api/discount-codes', init)
}

async function seedToken(opts: {
  id: string
  workspaceId: string
  tokenHash: string
  revoked?: boolean
  name?: string
}) {
  const all =
    ((await (stubs.tokens.get(ALL_TOKENS_KEY) as Promise<ApiTokenRecord[] | null>)) ??
      []) as ApiTokenRecord[]
  const record: ApiTokenRecord = {
    id: opts.id,
    workspaceId: opts.workspaceId,
    name: opts.name ?? 'Test token',
    tokenHash: opts.tokenHash,
    createdAt: new Date().toISOString(),
    revokedAt: opts.revoked ? new Date().toISOString() : undefined,
  }
  await stubs.tokens.set(ALL_TOKENS_KEY, [...all, record])
}

async function seedSnapshot(
  workspaceId: string,
  environment: 'test' | 'live',
  overrides: Partial<CouponSnapshot> = {},
): Promise<CouponSnapshot> {
  const snapshot: CouponSnapshot = {
    workspaceId,
    workspaceName: 'Test workspace',
    environment,
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
    ...overrides,
  }
  await stubs.snapshots.set(`${workspaceId}__${environment}`, snapshot)
  return snapshot
}

beforeEach(() => {
  stubs.tokens.clear()
  stubs.snapshots.clear()
})

/* -------------------------------------------------------------------------- */
/*                                  Tests                                      */
/* -------------------------------------------------------------------------- */

describe('POST /api/discount-codes', () => {
  describe('body validation', () => {
    it('returns 400 invalid_body when the body is not valid JSON', async () => {
      const res = await handle(makeRequest({ body: 'not json' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_body')
      expect(body.message).toMatch(/JSON/i)
    })

    it('returns 400 invalid_body when workspaceId is missing', async () => {
      const res = await handle(
        makeRequest({ body: { environment: 'test' } }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_body')
    })

    it('returns 400 invalid_body when environment is invalid', async () => {
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'staging' },
        }),
      )
      expect(res.status).toBe(400)
    })

    it('returns 400 invalid_body when neither field is present', async () => {
      const res = await handle(makeRequest({ body: {} }))
      expect(res.status).toBe(400)
    })
  })

  describe('auth', () => {
    it('returns 401 when no X-API-Key or Authorization header is sent', async () => {
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
        }),
      )
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('unauthorized')
      expect(body.message).toMatch(/X-API-Key|Bearer/i)
    })

    it('returns 401 when X-API-Key does not match any token (X-API-Key)', async () => {
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: { 'x-api-key': 'dcm_unknown' },
        }),
      )
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('unauthorized')
      expect(body.message).toMatch(/invalid or revoked/i)
    })

    it('returns 401 for an unknown Bearer token', async () => {
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: { authorization: 'Bearer dcm_unknown' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 401 when an Authorization header is malformed', async () => {
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: { authorization: 'Basic dcm_foo' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 401 when the matching token has been revoked', async () => {
      const plaintext = 'dcm_revoked'
      await seedToken({
        id: 'tok_1',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(plaintext),
        revoked: true,
      })
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: { 'x-api-key': plaintext },
        }),
      )
      expect(res.status).toBe(401)
    })
  })

  describe('workspace binding', () => {
    it('returns 403 forbidden when the token is bound to a different workspace', async () => {
      const plaintext = 'dcm_wrong_ws'
      await seedToken({
        id: 'tok_2',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(plaintext),
      })
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_B, environment: 'test' },
          headers: { 'x-api-key': plaintext },
        }),
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('forbidden')
      expect(body.message).toMatch(/not authorized/i)
    })
  })

  describe('snapshot lookup', () => {
    it('returns 404 not_published when no snapshot exists for this workspace/env', async () => {
      const plaintext = 'dcm_nosnap'
      await seedToken({
        id: 'tok_3',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(plaintext),
      })
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'live' },
          headers: { 'x-api-key': plaintext },
        }),
      )
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_published')
      expect(body.message).toMatch(/Refresh/i)
    })

    it('returns 200 with the snapshot via X-API-Key', async () => {
      const plaintext = 'dcm_x'
      await seedToken({
        id: 'tok_4',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(plaintext),
      })
      await seedSnapshot(WORKSPACE_A, 'test')
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: { 'x-api-key': plaintext },
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.workspaceId).toBe(WORKSPACE_A)
      expect(body.environment).toBe('test')
      expect(body.coupons).toHaveLength(1)
      expect(body.coupons[0].code).toBe('SUMMER25')
      expect(
        body.coupons[0].stripe.checkout_integration.discounts[0]
          .promotion_code,
      ).toBe('promo_123')
    })

    it('returns 200 with the snapshot via Authorization Bearer', async () => {
      const plaintext = 'dcm_bearer'
      await seedToken({
        id: 'tok_5',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(plaintext),
      })
      await seedSnapshot(WORKSPACE_A, 'live')
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'live' },
          headers: { authorization: `Bearer ${plaintext}` },
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.environment).toBe('live')
    })

    it('prefers X-API-Key over Authorization when both are present', async () => {
      const xPlain = 'dcm_x_first'
      await seedToken({
        id: 'tok_x',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(xPlain),
      })
      await seedSnapshot(WORKSPACE_A, 'test')
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: {
            'x-api-key': xPlain,
            authorization: 'Bearer dcm_unrelated',
          },
        }),
      )
      expect(res.status).toBe(200)
    })

    it('serves the same snapshot to two different tokens on the same workspace', async () => {
      const p1 = 'dcm_one'
      const p2 = 'dcm_two'
      await seedToken({
        id: 'tok_a',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(p1),
      })
      await seedToken({
        id: 'tok_b',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(p2),
      })
      const seeded = await seedSnapshot(WORKSPACE_A, 'test')
      const r1 = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: { 'x-api-key': p1 },
        }),
      )
      const r2 = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: { 'x-api-key': p2 },
        }),
      )
      expect(r1.status).toBe(200)
      expect(r2.status).toBe(200)
      const b1 = await r1.json()
      const b2 = await r2.json()
      expect(b1.publishedAt).toBe(seeded.publishedAt)
      expect(b2.publishedAt).toBe(seeded.publishedAt)
    })

    it('does not leak a snapshot for a different environment', async () => {
      const plaintext = 'dcm_env'
      await seedToken({
        id: 'tok_env',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(plaintext),
      })
      await seedSnapshot(WORKSPACE_A, 'test')
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'live' },
          headers: { 'x-api-key': plaintext },
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('response headers', () => {
    it('sets application/json and no-store on a 200 success', async () => {
      const plaintext = 'dcm_headers'
      await seedToken({
        id: 'tok_h',
        workspaceId: WORKSPACE_A,
        tokenHash: sha256Hex(plaintext),
      })
      await seedSnapshot(WORKSPACE_A, 'test')
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
          headers: { 'x-api-key': plaintext },
        }),
      )
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('application/json')
      expect(res.headers.get('cache-control')).toBe('no-store')
    })

    it('sets application/json and no-store on the 4xx error envelopes', async () => {
      const res = await handle(
        makeRequest({
          body: { workspaceId: WORKSPACE_A, environment: 'test' },
        }),
      )
      expect(res.status).toBe(401)
      expect(res.headers.get('content-type')).toContain('application/json')
      expect(res.headers.get('cache-control')).toBe('no-store')
    })
  })
})
