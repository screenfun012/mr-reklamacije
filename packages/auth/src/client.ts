import type { BetterAuthClientPlugin } from 'better-auth/client'
import { customSessionClient, twoFactorClient } from 'better-auth/client/plugins'

import type { Auth } from './better-auth.config.js'

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
