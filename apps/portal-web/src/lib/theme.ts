import { useSyncExternalStore } from 'react'

export type PortalTheme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'mrr:portal:theme'
const DEFAULT_THEME: PortalTheme = 'dark'

/**
 * Blocking inline script for `<head>` — applies the stored theme class to
 * `<html>` before first paint (SSR always renders the dark default), so a
 * light-theme user never sees a dark flash.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='light'){var d=document.documentElement;d.classList.remove('dark');d.classList.add('light');d.style.colorScheme='light';}}catch(e){}})();`

const subscribers = new Set<() => void>()

function notify(): void {
  for (const fn of subscribers) {
    fn()
  }
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

function readStoredTheme(): PortalTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function getSnapshot(): PortalTheme {
  return readStoredTheme()
}

function getServerSnapshot(): PortalTheme {
  return DEFAULT_THEME
}

let themeFlipTimer: ReturnType<typeof setTimeout> | undefined

function applyTheme(theme: PortalTheme): void {
  const root = document.documentElement
  // The palette must flip as ONE frame: any element with a colour transition trails
  // the rest otherwise (the submit button lagged the theme — Nikola, 2026-08-29).
  // The toggle's own glyphs are exempted in CSS; their cross-fade IS the feedback.
  root.classList.add('mrp-theme-flip')
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
  root.style.colorScheme = theme
  clearTimeout(themeFlipTimer)
  themeFlipTimer = setTimeout(() => root.classList.remove('mrp-theme-flip'), 150)
}

/** Reactive theme with persistence; the bootstrap script keeps first paint in sync. */
export function usePortalTheme(): {
  theme: PortalTheme
  toggleTheme: () => void
} {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return {
    theme,
    toggleTheme: () => {
      const next: PortalTheme = theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // Private mode — theme still applies for this page view.
      }
      applyTheme(next)
      notify()
    },
  }
}
