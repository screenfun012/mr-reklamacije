export { m } from './paraglide/messages.js'
export { baseLocale, getLocale, locales, setLocale } from './paraglide/runtime.js'
export type { Locale } from './paraglide/runtime.js'
export {
  LOCALE_BOOTSTRAP_SCRIPT,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
} from './locale-bootstrap-script.js'
export { syncRequestLocale } from './sync-request-locale.js'
export {
  PORTAL_DEFAULT_LOCALE,
  PORTAL_LOCALE_BOOTSTRAP_SCRIPT,
  syncPortalRequestLocale,
} from './portal-locale.js'
