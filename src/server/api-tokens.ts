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
 *
 * Each handler accepts `unknown` and re-validates with the Zod schema so
 * the test suite can drive validation directly. The server-fn
 * validators also run first, so the in-browser RPC path is doubly
 * protected.
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

export function requireAdminSecret(inputAuth: string): void {
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

const CreateTokenSchema = z.object({
  auth: z.string().min(8),
  workspaceId: z.string().min(1),
  name: z.string().min(1, 'Name your token').max(80),
})

export type CreateApiTokenInput = z.infer<typeof CreateTokenSchema>

export async function createApiTokenHandler(input: unknown): Promise<{
  ok: true
  token: {
    id: string
    plaintext: string
    last4: string
    workspaceId: string
    name: string
    createdAt: string
  }
}> {
  const data = CreateTokenSchema.parse(input)
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
    ok: true,
    token: {
      id: record.id,
      plaintext,
      last4: plaintext.slice(-4),
      workspaceId: record.workspaceId,
      name: record.name,
      createdAt: record.createdAt,
    },
  }
}

export const createApiTokenServerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => CreateTokenSchema.parse(d))
  .handler(async ({ data }) => createApiTokenHandler(data))

const RevokeTokenSchema = z.object({
  auth: z.string().min(8),
  tokenId: z.string().min(1),
})

export type RevokeApiTokenInput = z.infer<typeof RevokeTokenSchema>

export async function revokeApiTokenHandler(input: unknown): Promise<{
  ok: true
  revokedAt: string
}> {
  const data = RevokeTokenSchema.parse(input)
  requireAdminSecret(data.auth)
  const updated = await revokeTokenRecord(data.tokenId)
  if (!updated) {
    throw new Error('Token not found.')
  }
  return { ok: true, revokedAt: updated.revokedAt! }
}

export const revokeApiTokenServerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => RevokeTokenSchema.parse(d))
  .handler(async ({ data }) => revokeApiTokenHandler(data))

const ListSchema = z.object({ auth: z.string().min(8) })

export type ListApiTokensInput = z.infer<typeof ListSchema>

export async function listApiTokensHandler(input: unknown): Promise<{
  ok: true
  tokens: Array<{
    id: string
    workspaceId: string
    name: string
    createdAt: string
    revokedAt: string | null
  }>
}> {
  const data = ListSchema.parse(input)
  requireAdminSecret(data.auth)
  const all = await listAllTokenRecords()
  return {
    ok: true,
    tokens: all.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      name: t.name,
      createdAt: t.createdAt,
      revokedAt: t.revokedAt ?? null,
    })),
  }
}

export const listApiTokensServerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => ListSchema.parse(d))
  .handler(async ({ data }) => listApiTokensHandler(data))
