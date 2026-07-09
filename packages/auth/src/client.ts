import type { BetterAuthClientPlugin } from 'better-auth/client'
import { customSessionClient, twoFactorClient } from 'better-auth/client/plugins'

import type { Auth } from './better-auth.config.js'
import { setClientSession } from './client-session-store.js'

export { createAuthClient } from 'better-auth/react'
export { twoFactorClient }

/**
 * Standard MR Reklamacije client plugin set.
 *
 * Matches the server-side plugin list configured in
 * `better-auth.config.ts`: twoFactor + customSession (roles/permissions
 * on session user object).
 *
 * Each frontend (admin-web, internal-web, portal-web) should
 * instantiate its own auth client at module scope:
 *
 * ```ts
 * // apps/admin-web/src/lib/auth-client.ts
 * import { createAuthClient, authClientPlugins } from '@mr/auth/client';
 *
 * export const authClient = createAuthClient({
 *   baseURL: '/api/auth',
 *   plugins: authClientPlugins,
 * });
 * ```
 *
 * ## Why not a factory?
 *
 * A wrapping factory (`createAuthClient(options) => Client`)
 * forces TypeScript to materialise Better-Auth's plugin-extended
 * return type at the `@mr/auth` package boundary, which triggers
 * TS2742 (non-portable type references into better-auth
 * internals and transitive `zod`) and TS7056 (type too deep to
 * serialise into `.d.ts`).
 *
 * Letting the app call `createAuthClient` directly keeps the
 * inferred type at the call site (app code, no `.d.ts` emission)
 * while `@mr/auth/client` remains the single source of truth
 * for the plugin list.
 */
export const authClientPlugins: BetterAuthClientPlugin[] = [
  twoFactorClient(),
  customSessionClient<Auth>(),
]

/** 5 min — matches root route staleTime; session is not refreshed on tab focus. */
export const AUTH_SESSION_STALE_MS = 300_000

/**
 * Better-Auth client session options. Re-validate the session when the tab
 * regains focus: this is what lets a revoked/expired tab (e.g. single-device
 * kicked it from another login) notice and kick itself to /login when the user
 * returns, instead of showing a dead UI. Safe against false logouts — Better-Auth
 * keeps the previous session on non-401 errors, so only a real 401 signs out
 * (AuthProvider only redirects on a settled signed-in → signed-out transition).
 */
export const authClientSessionOptions = {
  refetchOnWindowFocus: true,
} as const

/**
 * A Better-Auth response to one of these paths has just established (or completed
 * via 2FA) a new session — the session cookie now differs from what the shared
 * client-session cache holds.
 */
function establishesSession(url: URL | string): boolean {
  const path = typeof url === 'string' ? url : url.pathname
  return path.includes('/sign-in/') || path.includes('/two-factor/verify')
}

/**
 * Shared fetch options for every app's Better-Auth client.
 *
 * `credentials: 'include'` sends the session cookie on every request.
 *
 * `onSuccess` fixes the "login needs two clicks" bug. After a sign-in (or 2FA
 * verify) response sets the new session cookie, the shared client-session cache
 * (client-session-store) still holds the pre-login value — settled signed-out.
 * The very next `navigate()` reads that stale cache in the root `beforeLoad` and
 * bounces straight back to /login, so the first click appears to do nothing;
 * only once Better-Auth refetches the session in the background does a second
 * click land. Resetting the cache to `undefined` here marks it unsettled, so the
 * next `beforeLoad` does one fresh `getSession()` that reads the new cookie — the
 * first click works. Applies to internal, admin and portal alike.
 */
export const authClientFetchOptions = {
  credentials: 'include',
  onSuccess: (context: { request: { url: URL | string } }): void => {
    if (establishesSession(context.request.url)) {
      setClientSession(undefined)
    }
  },
} as const
