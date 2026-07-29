/**
 * Admin-facing server functions for API token management.
 *
 * Every entry point requires `process.env.ADMIN_PUBLISH_SECRET` to match
 * the `auth` field in the request. The env var lives in Netlify (NOT in
 * the client) so anyone who doesn't know the value can't write to your
 * token store.
 *
 * Tokens are returned plaintext exactly once (on creation). The server
 * stores only their SHA-256 hash.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { randomSecret, sha256Hex } from './storage'
import {
  createTokenRecord,
  listAllTokenRecords,
  revokeTokenRecord,
} from './blob-store'

const TOKEN_PREFIX = 'dcm'

function requireAdminSecret(inputAuth: string): void {
  const expected = process.env.ADMIN_PUBLISH_SECRET?.trim()
  if (!expected) {
    throw new Error(
      'ADMIN_PUBLISH_SECRET is not configured on the server. Add it as a Netlify env var to enable token management.',
    )
  }
  if (inputAuth !== expected) {
    throw new Error('Unauthorized.')
  }
}

const AuthSchema = z.object({ auth: z.string().min(8) })

const CreateTokenSchema = AuthSchema.extend({
  workspaceId: z.string().min(1),
  name: z.string().min(1, 'Name your token').max(80),
})

export const createApiTokenServerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => CreateTokenSchema.parse(d))
  .handler(async ({ data }) => {
    requireAdminSecret(data.auth)
    const plaintext = `${TOKEN_PREFIX}_${randomSecret()}`
    const tokenHash = sha256Hex(plaintext)
    const id = `tok_${randomSecret().slice(0, 12)}`
    const record = await createTokenRecord({
      id,
      workspaceId: data.workspaceId,
      name: data.name,
      tokenHash,
    })
    return {
      ok: true as const,
      token: {
        id: record.id,
        plaintext,
        last4: plaintext.slice(-4),
        workspaceId: record.workspaceId,
        name: record.name,
        createdAt: record.createdAt,
      },
    }
  })

const RevokeTokenSchema = AuthSchema.extend({
  tokenId: z.string().min(1),
})

export const revokeApiTokenServerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => RevokeTokenSchema.parse(d))
  .handler(async ({ data }) => {
    requireAdminSecret(data.auth)
    const updated = await revokeTokenRecord(data.tokenId)
    if (!updated) {
      throw new Error('Token not found.')
    }
    return { ok: true as const, revokedAt: updated.revokedAt! }
  })

const ListSchema = AuthSchema

export const listApiTokensServerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => ListSchema.parse(d))
  .handler(async ({ data }) => {
    requireAdminSecret(data.auth)
    const all = await listAllTokenRecords()
    return {
      ok: true as const,
      tokens: all.map((t) => ({
        id: t.id,
        workspaceId: t.workspaceId,
        name: t.name,
        createdAt: t.createdAt,
        revokedAt: t.revokedAt ?? null,
      })),
    }
  })
