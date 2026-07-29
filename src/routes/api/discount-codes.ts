/**
 * Public REST endpoint.
 *
 *   POST /api/discount-codes
 *
 * Headers:
 *   - X-API-Key: <token>           (preferred — what the in-app docs prescribe)
 *   - Authorization: Bearer <token> (also accepted for standardness)
 *
 * Body (JSON):
 *   {
 *     "workspaceId":  "ws_...",
 *     "environment":  "test" | "live"
 *   }
 *
 * Response:
 *   - 200 with the snapshot JSON
 *   - 400 invalid_body
 *   - 401 unauthorized (missing/invalid/revoked token)
 *   - 403 forbidden (token's workspace ≠ requested workspace)
 *   - 404 not_published (no snapshot yet — refresh in the manager app)
 *
 * The endpoint reads ONLY from Netlify Blobs. It never sees the user's
 * Stripe secret key.
 *
 * `handle` is exported so the test suite can drive it directly without
 * spinning up the full TanStack Start runtime.
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { findTokenByHash, readSnapshot } from '#/server/blob-store'
import { sha256Hex } from '#/server/storage'

const BodySchema = z.object({
  workspaceId: z.string().min(1),
  environment: z.enum(['test', 'live']),
})

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  })
}

async function extractApiKey(request: Request): Promise<string | null> {
  const xKey = request.headers.get('x-api-key')
  if (xKey?.trim()) return xKey.trim()
  const auth = request.headers.get('authorization')
  if (!auth) return null
  const m = /^Bearer\s+(.+)$/i.exec(auth)
  return m?.[1]?.trim() ?? null
}

export async function handle(request: Request): Promise<Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonResponse(
      { error: 'invalid_body', message: 'JSON body required.' },
      { status: 400 },
    )
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return jsonResponse(
      {
        error: 'invalid_body',
        message: 'Body must be { workspaceId: string, environment: "test" | "live" }.',
      },
      { status: 400 },
    )
  }

  const apiKey = await extractApiKey(request)
  if (!apiKey) {
    return jsonResponse(
      {
        error: 'unauthorized',
        message:
          'Provide an API key via X-API-Key header or "Authorization: Bearer <token>".',
      },
      { status: 401 },
    )
  }

  const hash = sha256Hex(apiKey)
  const record = await findTokenByHash(hash)
  if (!record) {
    return jsonResponse(
      { error: 'unauthorized', message: 'Invalid or revoked API key.' },
      { status: 401 },
    )
  }

  if (record.workspaceId !== parsed.data.workspaceId) {
    return jsonResponse(
      {
        error: 'forbidden',
        message: 'This token is not authorized for the requested workspace.',
      },
      { status: 403 },
    )
  }

  const snapshot = await readSnapshot(
    parsed.data.workspaceId,
    parsed.data.environment,
  )
  if (!snapshot) {
    return jsonResponse(
      {
        error: 'not_published',
        message:
          'No snapshot for this workspace/environment. Open the Stripe Coupon Manager and click Refresh first.',
      },
      { status: 404 },
    )
  }

  return jsonResponse(snapshot, { status: 200 })
}

export const Route = createFileRoute('/api/discount-codes')({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
})
