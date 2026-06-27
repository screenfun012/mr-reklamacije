import { extractLocaleFromRequest, getLocale, setLocale, type Locale } from './paraglide/runtime.js'

function isBrowser(): boolean {
  const g = globalThis as typeof globalThis & { window?: unknown }
  return typeof g.window !== 'undefined'
}

interface RequestHeaderSource {
  get(name: string): string | null | undefined
}

/** TanStack `getRequestHeaders()` returns a bag with `.get()`, not a plain HeadersInit record. */
function toRequestHeaders(source: RequestHeaderSource): Headers {
  if (source instanceof Headers) {
    return source
  }

  const headers = new Headers()
  const cookie = source.get('cookie')
  if (cookie !== null && cookie !== undefined && cookie !== '') {
    headers.set('cookie', cookie)
  }
  const acceptLanguage = source.get('accept-language')
  if (acceptLanguage !== null && acceptLanguage !== undefined && acceptLanguage !== '') {
    headers.set('accept-language', acceptLanguage)
  }
  return headers
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
    const request = new Request(url, { headers: toRequestHeaders(headers) })
    const locale = extractLocaleFromRequest(request)
    setLocale(locale, { reload: false })
    return locale
  } catch {
    return getLocale()
  }
}
