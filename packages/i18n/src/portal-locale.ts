import * as runtime from './paraglide/runtime.js'
import type { Locale } from './paraglide/runtime.js'
import { paraglideMiddleware } from './paraglide/server.js'

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
 * Blocking inline script for the portal `<head>`. Same rule as the internal one
 * ({@link LOCALE_BOOTSTRAP_SCRIPT}): an EXISTING cookie wins and is mirrored into localStorage,
 * because the server has already rendered with it and overwriting it here would change the
 * language between SSR and hydration — which React answers by throwing the whole tree away.
 *
 * With nothing stored the portal pins its default (en) so SSR and client agree from the very
 * first render.
 */
export const PORTAL_LOCALE_BOOTSTRAP_SCRIPT = `(function(){try{var ls='${runtime.localStorageKey}';var cn='${runtime.cookieName}';var m=document.cookie.match(new RegExp('(?:^|; *)'+cn+'=(sr|en)'));if(m){localStorage.setItem(ls,m[1]);return;}var l=localStorage.getItem(ls);if(l!=='sr'&&l!=='en'){l='${PORTAL_DEFAULT_LOCALE}';localStorage.setItem(ls,l);}document.cookie=cn+'='+l+'; path=/; max-age=${runtime.cookieMaxAge}';}catch(e){}})();`

/**
 * Resolve the portal locale from the request cookie ONLY — never Accept-Language
 * — falling back to the portal default (en). This encodes the portal's
 * deliberate policy: cookie wins, Accept-Language ignored, English by default.
 */
export function resolvePortalLocaleFromRequest(request: Request): Locale {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const match = new RegExp(`(?:^|;\\s*)${runtime.cookieName}=(sr|en)`).exec(cookieHeader)
  const stored = match?.[1]
  return isKnownLocale(stored) ? stored : PORTAL_DEFAULT_LOCALE
}

/**
 * SSR wrapper for the portal. Runs the request through Paraglide's
 * `paraglideMiddleware`, which installs and enters a per-request
 * AsyncLocalStorage locale context — then overrides the stored locale with the
 * portal resolution, because the compiled strategy would honour Accept-Language
 * and default to Serbian, the two things the portal refuses. Every `getLocale()`
 * on this request reads the per-request store, so concurrent visitors never
 * share locale state.
 */
export function runWithPortalRequestLocale(
  request: Request,
  resolve: () => Response | Promise<Response>,
): Promise<Response> {
  return paraglideMiddleware(request, () => {
    const store = runtime.serverAsyncLocalStorage?.getStore()
    if (store) {
      store.locale = resolvePortalLocaleFromRequest(request)
    }
    return resolve()
  })
}
