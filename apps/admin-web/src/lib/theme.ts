import { THEME_STORAGE_KEY } from '@mr/shared'
import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = THEME_STORAGE_KEY
const VALID_THEMES: ReadonlyArray<Theme> = ['light', 'dark', 'system']

/**
 * Dark-first, matching internal-web. Colours alone were not enough: people move between the two
 * apps all day, and on a light-set machine admin opened white while internal opened black — which
 * read as two different products no matter how close the palettes were.
 *
 * A stored choice (including 'system') still wins. Only somebody who has never picked gets this.
 */
const DEFAULT_THEME: Theme = 'dark'

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (VALID_THEMES as ReadonlyArray<string>).includes(value)
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isTheme(raw) ? raw : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

function applyDocumentClass(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return
  }
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

interface ThemeStore {
  theme: Theme
  resolvedTheme: ResolvedTheme
}

const listeners = new Set<() => void>()
let currentTheme: Theme = typeof window === 'undefined' ? DEFAULT_THEME : readStoredTheme()
let currentResolved: ResolvedTheme = resolve(currentTheme)
let snapshot: ThemeStore = { theme: currentTheme, resolvedTheme: currentResolved }
// SSR paints dark: the bootstrap script corrects a stored light preference before the first
// frame, but a light server snapshot would flash white on every load for everyone else.
const serverSnapshot: ThemeStore = { theme: DEFAULT_THEME, resolvedTheme: 'dark' }

function notify(): void {
  snapshot = { theme: currentTheme, resolvedTheme: currentResolved }
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ThemeStore {
  return snapshot
}

function getServerSnapshot(): ThemeStore {
  return serverSnapshot
}

let mediaQueryAttached = false

function ensureSystemListener(): void {
  if (mediaQueryAttached) {
    return
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  mql.addEventListener('change', () => {
    if (currentTheme !== 'system') {
      return
    }
    const next = getSystemTheme()
    if (next === currentResolved) {
      return
    }
    currentResolved = next
    applyDocumentClass(currentResolved)
    notify()
  })
  mediaQueryAttached = true
}

if (typeof window !== 'undefined') {
  applyDocumentClass(currentResolved)
  ensureSystemListener()
}

export function setTheme(next: Theme): void {
  currentTheme = next
  currentResolved = resolve(next)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore storage failures (private mode, quota); theme still
      // applies for the current session.
    }
    applyDocumentClass(currentResolved)
    ensureSystemListener()
  }
  notify()
}

export interface UseThemeResult {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export function useTheme(): UseThemeResult {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    theme: store.theme,
    resolvedTheme: store.resolvedTheme,
    setTheme,
  }
}
