/**
 * Storage primitives for the public API machinery.
 *
 * Backed by Netlify Blobs in production / `netlify dev`. Falls back to a
 * per-process in-memory Map when the Netlify runtime context is missing
 * (i.e. raw `vite dev` for hacking on the UI) so the rest of the app
 * doesn't crash.
 *
 * Two stores are exposed:
 *   - `getTokensStore()`     — keyed by '__all_tokens__', holds the full
 *     list of ApiTokenRecord entries. Read-modify-write.
 *   - `getSnapshotsStore()`  — keyed by `${workspaceId}__${environment}`,
 *     keyed lookup. One blob per snapshot.
 */
import { createHash, randomBytes } from 'node:crypto'

interface JsonStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<string[]>
}

function createMemoryStore(): JsonStore {
  const map = new Map<string, string>()
  return {
    async get<T>(key: string) {
      const raw = map.get(key)
      return raw ? (JSON.parse(raw) as T) : null
    },
    async set<T>(key: string, value: T) {
      map.set(key, JSON.stringify(value))
    },
    async delete(key: string) {
      map.delete(key)
    },
    async list() {
      return Array.from(map.keys())
    },
  }
}

async function createNetlifyStore(name: string): Promise<JsonStore> {
  // Lazy import so the module evaluation doesn't crash in a non-
  // Netlify runtime.
  const mod = await import('@netlify/blobs')
  const store = mod.getStore({ name, consistency: 'strong' })
  return {
    async get<T>(key: string) {
      const raw = await store.get(key, { type: 'text' })
      return raw ? (JSON.parse(raw) as T) : null
    },
    async set<T>(key: string, value: T) {
      await store.set(key, JSON.stringify(value))
    },
    async delete(key: string) {
      await store.delete(key)
    },
    async list() {
      const { blobs } = await store.list()
      return blobs.map((b) => b.key)
    },
  }
}

const caches = new Map<string, Promise<JsonStore>>()

function makeStore(name: string): Promise<JsonStore> {
  let p = caches.get(name)
  if (p) return p
  p = (async () => {
    if (!process.env.NETLIFY_BLOBS_CONTEXT && !process.env.NETLIFY) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[scm/storage] Using in-memory store for "${name}" — set NETLIFY_BLOBS_CONTEXT or run via "netlify dev" for real persistence.`,
        )
      }
      return createMemoryStore()
    }
    try {
      return await createNetlifyStore(name)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[scm/storage] @netlify/blobs unavailable for "${name}": ${err instanceof Error ? err.message : String(err)}. Falling back to in-memory.`,
        )
      }
      return createMemoryStore()
    }
  })()
  caches.set(name, p)
  return p
}

export function getTokensStore(): Promise<JsonStore> {
  return makeStore('scm-tokens')
}

export function getSnapshotsStore(): Promise<JsonStore> {
  return makeStore('scm-snapshots')
}

/* -------------------------------------------------------------------------- */
/*                                Crypto helpers                              */
/* -------------------------------------------------------------------------- */

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * URL-safe random bytes encoded for human copy-paste. Uses 24 bytes
 *   (~192 bits) which is well beyond brute-force territory.
 */
export function randomSecret(): string {
  return randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
