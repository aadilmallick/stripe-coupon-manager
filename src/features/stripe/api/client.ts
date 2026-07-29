/**
 * Tiny, dependency-free Stripe REST client.
 *
 * - Bearer token auth (would never leave the browser in this app).
 * - `application/x-www-form-urlencoded` request body, per Stripe spec.
 * - Stripe returns `{ error: { type, message, code, ... } }` on failure.
 *
 * We never throw the raw Stripe JSON upward — errors get translated into
 * typed `StripeApiError` instances callers can reason about.
 */
import type { ZodTypeAny, z } from 'zod'

const STRIPE_API_BASE = 'https://api.stripe.com/v1'

export class StripeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly type?: string,
    public readonly code?: string,
    public readonly declineCode?: string,
    public readonly param?: string,
    public readonly raw?: unknown,
  ) {
    super(message)
    this.name = 'StripeApiError'
  }
}

export class StripeNetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'StripeNetworkError'
  }
}

export type StripeRequestParamValue =
  | string
  | number
  | boolean
  | string[]
  | undefined
  | null

export type StripeRequestParams = Record<string, StripeRequestParamValue>

interface RequestOptions {
  apiKey: string
  params?: StripeRequestParams
  signal?: AbortSignal
}

function appendParams(usp: URLSearchParams, params?: StripeRequestParams) {
  if (!params) return
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue
    // Stripe list APIs accept repeated `expand[]` and `created[]` keys.
    if (Array.isArray(v)) {
      for (const item of v) usp.append(k, String(item))
    } else {
      usp.append(k, String(v))
    }
  }
}

function buildQuery(params?: StripeRequestParams) {
  const usp = new URLSearchParams()
  appendParams(usp, params)
  const s = usp.toString()
  return s ? `?${s}` : ''
}

function buildBody(params?: StripeRequestParams) {
  const usp = new URLSearchParams()
  appendParams(usp, params)
  return usp.toString()
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  { apiKey, params, signal }: RequestOptions,
  schema: ZodTypeAny,
): Promise<T> {
  const url = `${STRIPE_API_BASE}${path}${buildQuery(
    method === 'GET' ? params : undefined,
  )}`
  const body = method === 'GET' ? undefined : buildBody(params)

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal,
    })
  } catch (cause) {
    throw new StripeNetworkError(
      'Could not reach Stripe. Check your network and try again.',
      cause,
    )
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const err =
      (payload as { error?: Record<string, unknown> })?.error ?? undefined
    throw new StripeApiError(
      (err?.message as string) || `Stripe request failed (${res.status})`,
      res.status,
      err?.type as string | undefined,
      err?.code as string | undefined,
      err?.decline_code as string | undefined,
      err?.param as string | undefined,
      payload,
    )
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new StripeApiError(
      'Stripe returned an unexpected response shape.',
      res.status,
      undefined,
      undefined,
      undefined,
      undefined,
      payload,
    )
  }
  return parsed.data as T
}

export interface StripeClient {
  get<T extends ZodTypeAny>(
    path: string,
    options: RequestOptions,
    schema: T,
  ): Promise<z.infer<T>>
  post<T extends ZodTypeAny>(
    path: string,
    options: RequestOptions,
    schema: T,
  ): Promise<z.infer<T>>
  delete<T extends ZodTypeAny>(
    path: string,
    options: RequestOptions,
    schema: T,
  ): Promise<z.infer<T>>
}

export function createStripeClient(): StripeClient {
  return {
    get: (path, options, schema) => request('GET', path, options, schema),
    post: (path, options, schema) => request('POST', path, options, schema),
    delete: (path, options, schema) => request('DELETE', path, options, schema),
  }
}

/**
 * Iterate every page of a Stripe list endpoint, returning all rows.
 * Stripe cursors arrive on the URL of the last response, but we'll
 * fetch by `starting_after` which is simpler & friendlier.
 */
export async function listAll<TItem extends ZodTypeAny>(
  client: StripeClient,
  path: string,
  apiKey: string,
  baseParams: Record<string, string | number | boolean | string[] | undefined>,
  listSchema: ZodTypeAny,
  signal?: AbortSignal,
): Promise<Array<z.infer<TItem>>> {
  const collected: Array<z.infer<TItem>> = []
  let starting_after: string | undefined
  // Safety cap to avoid unbounded loops if Stripe does something weird.
  const MAX_PAGES = 50
  for (let i = 0; i < MAX_PAGES; i++) {
    const params: StripeRequestParams = {
      ...baseParams,
      limit: 100,
    }
    if (starting_after) params.starting_after = starting_after
    const page = await client.get(path, { apiKey, params, signal }, listSchema)
    const data = (page as { data?: Array<z.infer<TItem>> }).data ?? []
    collected.push(...data)
    const has_more = (page as { has_more?: boolean }).has_more === true
    if (!has_more || data.length === 0) break
    const last = data[data.length - 1] as unknown as { id: string }
    starting_after = last.id
  }
  return collected
}
