import { storage } from './localforage-instance'
import type { StripeWorkspace } from '#/features/stripe/types/workspace'

const WORKSPACES_KEY = 'workspaces.v1'

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const fallbackMemoryStore: Record<string, StripeWorkspace[]> = {
  [WORKSPACES_KEY]: [],
}

const memoryFallback = {
  async getItem<T>(key: string): Promise<T | null> {
    return (fallbackMemoryStore[key] as T | undefined) ?? null
  },
  async setItem<T>(key: string, value: T): Promise<T> {
    fallbackMemoryStore[key] = value as never
    return value
  },
  async removeItem(key: string): Promise<void> {
    delete fallbackMemoryStore[key]
  },
}

const backing = isBrowser() ? storage : memoryFallback

function nowIso() {
  return new Date().toISOString()
}

export function genId() {
  // crypto.randomUUID is supported in all modern browsers.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `ws_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

export async function loadWorkspaces(): Promise<StripeWorkspace[]> {
  return (await backing.getItem<StripeWorkspace[]>(WORKSPACES_KEY)) ?? []
}

export async function saveWorkspaces(list: StripeWorkspace[]) {
  await backing.setItem(WORKSPACES_KEY, list)
}

export async function createWorkspace(input: {
  name: string
  description?: string
  testKey?: string
  liveKey?: string
}): Promise<StripeWorkspace> {
  const list = await loadWorkspaces()
  const now = nowIso()
  const workspace: StripeWorkspace = {
    id: genId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    testKey: input.testKey,
    liveKey: input.liveKey,
    createdAt: now,
    updatedAt: now,
  }
  await saveWorkspaces([...list, workspace])
  return workspace
}

export async function updateWorkspace(
  id: string,
  patch: Partial<Pick<StripeWorkspace, 'name' | 'description' | 'testKey' | 'liveKey'>>,
): Promise<StripeWorkspace> {
  const list = await loadWorkspaces()
  const idx = list.findIndex((w) => w.id === id)
  if (idx < 0) throw new Error('Workspace not found')
  const next: StripeWorkspace = {
    ...list[idx],
    ...patch,
    updatedAt: nowIso(),
  }
  const copy = list.slice()
  copy[idx] = next
  await saveWorkspaces(copy)
  return next
}

export async function deleteWorkspace(id: string): Promise<void> {
  const list = await loadWorkspaces()
  await saveWorkspaces(list.filter((w) => w.id !== id))
}

export async function exportWorkspacesAsJson(): Promise<string> {
  const list = await loadWorkspaces()
  return JSON.stringify({ version: 1, workspaces: list }, null, 2)
}

export async function importWorkspacesFromJson(
  raw: string,
  mode: 'merge' | 'replace',
): Promise<StripeWorkspace[]> {
  const parsed = JSON.parse(raw)
  const incoming = Array.isArray(parsed) ? parsed : parsed.workspaces
  if (!Array.isArray(incoming)) {
    throw new Error('Import payload must contain a "workspaces" array')
  }
  // Strip secret material on import — keys should be re-entered manually
  // so that exports can be shared without leaking credentials.
  const sanitized = incoming.map((w) => ({
    id: genId(),
    name: String(w.name ?? 'Untitled'),
    description:
      typeof w.description === 'string' ? w.description : undefined,
    testKey: undefined,
    liveKey: undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }))
  const next =
    mode === 'replace' ? sanitized : [...(await loadWorkspaces()), ...sanitized]
  await saveWorkspaces(next)
  return next
}
