import { baseLocale, getLocale, setLocale as paraglideSetLocale, type Locale } from '@mr/i18n'
import { useSyncExternalStore } from 'react'

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

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && ['sr', 'en'].includes(value)
}

function getServerSnapshot(): Locale {
  return getLocale()
}

function getSnapshot(): Locale {
  return getLocale()
}

/**
 * Locale picker + reactive reads aligned with Paraglide `m.*` (they call
 * `getLocale()` internally). `setLocale(..., { reload: false })` persists via
 * Paraglide strategies (`mrr:locale` + cookie); `notify()` re-renders subscribed hooks.
 */
export function useLocale(): {
  locale: Locale
  setLocale: (locale: Locale) => void
} {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return {
    locale,
    setLocale: (newLocale: Locale) => {
      if (!isLocale(newLocale)) {
        return
      }
      paraglideSetLocale(newLocale, { reload: false })
      notify()
    },
  }
}

export { baseLocale }
