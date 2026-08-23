/**
 * The two remembered choices that decide the LAYOUT, kept in cookies rather than localStorage.
 *
 * Not a preference about storage — arithmetic. The server renders the sidebar, and localStorage
 * is a thing only the browser can see, so the server always drew the rail open and the menu long;
 * the browser then read the real answer after mount and slid everything into place. Measured
 * 2026-08-24 on `/reklamacije` with the rail remembered as collapsed: **CLS 2.31** over thirty
 * separate shifts, because the 240px→60px rail dragged the whole page left one frame at a time
 * and the claims table relaid out on the way. That is Nikola's „ceo ekran se šiftira".
 *
 * A cookie rides along with the request, so the server renders what the browser is about to.
 * Same reasoning the locale already follows (`@mr/i18n`), and for the same reason: a value that
 * changes what is DRAWN cannot live where only one of the two sides can read it.
 *
 * ⚠ Layout only. A remembered choice that changes no geometry — the chat's DND switch — has no
 * business in a cookie, which is sent on every single request.
 */
export const SIDEBAR_COLLAPSED_COOKIE = 'mrr_internal_sidebar'
export const CLAIMS_NAV_OPEN_COOKIE = 'mrr_internal_nav_claims'

export interface InternalUiPrefs {
  sidebarCollapsed: boolean
  claimsNavOpen: boolean
}

/** `'1'` / `'0'`, and anything else means "never chosen" so the caller's default stands. */
function flagOf(cookies: string, name: string, fallback: boolean): boolean {
  const match = new RegExp(`(?:^|; )${name}=([01])`).exec(cookies)
  return match === null ? fallback : match[1] === '1'
}

export function parseInternalUiPrefs(cookies: string): InternalUiPrefs {
  return {
    sidebarCollapsed: flagOf(cookies, SIDEBAR_COLLAPSED_COOKIE, false),
    claimsNavOpen: flagOf(cookies, CLAIMS_NAV_OPEN_COOKIE, true),
  }
}

/**
 * A year, `SameSite=Lax`, no `Secure` flag hardcoded — dev is plain http on localhost and a
 * `Secure` cookie would simply never be stored there, which is the quiet way this fix would look
 * like it did nothing. Production is https and Lax is enough: nothing here is a credential, the
 * worst a forged value can do is open a menu.
 */
export function writeUiFlagCookie(name: string, value: boolean): void {
  document.cookie = `${name}=${value ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`
}
