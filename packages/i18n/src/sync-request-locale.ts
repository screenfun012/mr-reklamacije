import { extractLocaleFromRequest, getLocale, setLocale, type Locale } from './paraglide/runtime.js'

function isBrowser(): boolean {
  const g = globalThis as typeof globalThis & { window?: unknown }
  return typeof g.window !== 'undefined'
}

/**
 * Resolves locale from the incoming SSR request (cookie, Accept-Language, baseLocale)
 * and pins it via Paraglide `setLocale` so `m.*()` and `getLocale()` match on the server.
 */
export async function syncRequestLocale(): Promise<Locale> {
  if (isBrowser()) {
    return getLocale()
  }

  try {
    const { getRequestHeaders, getRequestUrl } = await import('@tanstack/react-start/server')
    const headers = getRequestHeaders()
    const url = getRequestUrl()
    const request = new Request(url, { headers: new Headers(headers as HeadersInit) })
    const locale = extractLocaleFromRequest(request)
    setLocale(locale, { reload: false })
    return locale
  } catch {
    return getLocale()
  }
}
