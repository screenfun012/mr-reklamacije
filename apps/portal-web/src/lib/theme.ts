import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'mrr:theme';
const VALID_THEMES: ReadonlyArray<Theme> = ['light', 'dark', 'system'];

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (VALID_THEMES as ReadonlyArray<string>).includes(value);
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'system';
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyDocumentClass(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface ThemeStore {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
}

const listeners = new Set<() => void>();
let currentTheme: Theme =
  typeof window === 'undefined' ? 'system' : readStoredTheme();
let currentResolved: ResolvedTheme = resolve(currentTheme);
let snapshot: ThemeStore = { theme: currentTheme, resolvedTheme: currentResolved };
const serverSnapshot: ThemeStore = { theme: 'system', resolvedTheme: 'light' };

function notify(): void {
  snapshot = { theme: currentTheme, resolvedTheme: currentResolved };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemeStore {
  return snapshot;
}

function getServerSnapshot(): ThemeStore {
  return serverSnapshot;
}

let mediaQueryAttached = false;

function ensureSystemListener(): void {
  if (mediaQueryAttached) {
    return;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    if (currentTheme !== 'system') {
      return;
    }
    const next = getSystemTheme();
    if (next === currentResolved) {
      return;
    }
    currentResolved = next;
    applyDocumentClass(currentResolved);
    notify();
  });
  mediaQueryAttached = true;
}

if (typeof window !== 'undefined') {
  applyDocumentClass(currentResolved);
  ensureSystemListener();
}

export function setTheme(next: Theme): void {
  currentTheme = next;
  currentResolved = resolve(next);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (private mode, quota); theme still
      // applies for the current session.
    }
    applyDocumentClass(currentResolved);
    ensureSystemListener();
  }
  notify();
}

export interface UseThemeResult {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

export function useTheme(): UseThemeResult {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    theme: store.theme,
    resolvedTheme: store.resolvedTheme,
    setTheme,
  };
}
