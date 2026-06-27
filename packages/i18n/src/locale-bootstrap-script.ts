import { cookieMaxAge, cookieName, localStorageKey } from './paraglide/runtime.js'

export { cookieName as LOCALE_COOKIE_NAME, localStorageKey as LOCALE_STORAGE_KEY }

/**
 * Blocking inline script for `<head>` — mirrors `mrr:locale` from localStorage into
 * the Paraglide cookie before React hydrates so SSR and client agree on hard refresh.
 */
export const LOCALE_BOOTSTRAP_SCRIPT = `(function(){try{var ls='${localStorageKey}';var cn='${cookieName}';var l=localStorage.getItem(ls);if(l&&(l==='sr'||l==='en')){document.cookie=cn+'='+l+'; path=/; max-age=${cookieMaxAge}';}}catch(e){}})();`
