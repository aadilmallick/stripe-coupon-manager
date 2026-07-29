import { storage } from './localforage-instance'
import { PreferencesSchema, type Preferences } from '#/features/stripe/schemas/workspace'

const KEY = 'preferences.v1'

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const mem: Record<string, Preferences> = {}

const backing = isBrowser() ? storage : {
  async getItem<T>(key: string): Promise<T | null> {
    return (mem[key] as T | undefined) ?? null
  },
  async setItem<T>(key: string, value: T): Promise<T> {
    mem[key] = value as never
    return value
  },
}

const DEFAULT: Preferences = {
  selectedWorkspaceId: null,
  selectedEnvironment: 'test',
  showOnlyActive: true,
}

export async function loadPreferences(): Promise<Preferences> {
  const raw = await backing.getItem<Preferences>(KEY)
  if (!raw) return DEFAULT
  const parsed = PreferencesSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT
}

export async function savePreferences(patch: Partial<Preferences>) {
  const current = await loadPreferences()
  const next = { ...current, ...patch }
  await backing.setItem(KEY, next)
  return next
}
