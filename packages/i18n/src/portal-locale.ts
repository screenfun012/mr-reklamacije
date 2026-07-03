import {
  cookieMaxAge,
  cookieName,
  getLocale,
  localStorageKey,
  setLocale,
  type Locale,
} from './paraglide/runtime.js'

/**
 * The client portal defaults to ENGLISH (design requirement — the clients are
 * international EMOTIVE partners), unlike the internal apps where Serbian is
 * primary. A stored choice (cookie/localStorage) always wins; Accept-Language
 * is deliberately ignored so every visitor starts in English.
 */
export const PORTAL_DEFAULT_LOCALE: Locale = 'en'

function isKnownLocale(value: string | undefined): value is Locale {
  return value === 'sr' || value === 'en'
}

/**
 * Blocking inline script for the portal `<head>`: mirrors a stored locale into
 * the cookie, and — when nothing is stored — pins the portal default (en) so
 * SSR and client agree from the very first render.
 */
export const PORTAL_LOCALE_BOOTSTRAP_SCRIPT = `(function(){try{var ls='${localStorageKey}';var cn='${cookieName}';var l=localStorage.getItem(ls);if(l!=='sr'&&l!=='en'){l='${PORTAL_DEFAULT_LOCALE}';localStorage.setItem(ls,l);}document.cookie=cn+'='+l+'; path=/; max-age=${cookieMaxAge}';}catch(e){}})();`

/**
 * SSR half of the portal default: resolve the locale from the request cookie
 * only, falling back to the portal default — never Accept-Language — and pin
 * it so server-rendered `m.*()` output matches what the client will show.
 */
export async function syncPortalRequestLocale(): Promise<Locale> {
  const g = globalThis as typeof globalThis & { window?: unknown }
  if (typeof g.window !== 'undefined') {
    return getLocale()
  }

  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const cookieHeader = getRequestHeaders().get('cookie') ?? ''
    const match = new RegExp(`(?:^|;\\s*)${cookieName}=(sr|en)`).exec(cookieHeader)
    const stored = match?.[1]
    const locale = isKnownLocale(stored) ? stored : PORTAL_DEFAULT_LOCALE
    setLocale(locale, { reload: false })
    return locale
  } catch {
    return getLocale()
  }
}
