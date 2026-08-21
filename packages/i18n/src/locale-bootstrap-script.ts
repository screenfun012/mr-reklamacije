import { cookieMaxAge, cookieName, localStorageKey } from './paraglide/runtime.js'

export { cookieName as LOCALE_COOKIE_NAME, localStorageKey as LOCALE_STORAGE_KEY }

/**
 * Blocking inline script for `<head>` — keeps the cookie and `mrr:locale` agreeing so SSR and
 * hydration render the SAME language.
 *
 * The COOKIE WINS when it exists, and the script only mirrors it into localStorage. That
 * direction is not a preference, it is arithmetic: the strategy order is cookie-first on both
 * sides, so the server has already rendered with whatever cookie the request carried. The old
 * script did the opposite — it copied localStorage OVER the cookie before hydration — so any
 * disagreement between the two flipped the language mid-load and React threw
 * "Hydration failed because the server rendered text didn't match the client".
 *
 * That is not a cosmetic error: React then throws the server tree away and re-renders from
 * scratch, and a claim screen came back with its buttons gone and its cards empty — a screen
 * that reads as unfinished software (found 2026-08-21, cookie said `en`, localStorage said `sr`).
 *
 * With no cookie yet — the first load after someone picked a language in another tab — the
 * stored choice seeds it, which is what this script was written for.
 */
export const LOCALE_BOOTSTRAP_SCRIPT = `(function(){try{var ls='${localStorageKey}';var cn='${cookieName}';var m=document.cookie.match(new RegExp('(?:^|; *)'+cn+'=(sr|en)'));if(m){localStorage.setItem(ls,m[1]);return;}var l=localStorage.getItem(ls);if(l==='sr'||l==='en'){document.cookie=cn+'='+l+'; path=/; max-age=${cookieMaxAge}';}}catch(e){}})();`
