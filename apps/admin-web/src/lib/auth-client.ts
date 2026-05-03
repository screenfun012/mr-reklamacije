/// <reference types="vite/client" />
import { authClientPlugins, createAuthClient } from '@mr/auth/client';

/**
 * Better-Auth client instance for admin-web frontend.
 *
 * Uses the @mr/auth/client preset which re-exports createAuthClient
 * from better-auth/react and exposes the authClientPlugins list
 * (twoFactorClient) that matches the server-side sharedAuthOptions.
 *
 * ## Why two baseURL branches
 *
 * Better-Auth passes baseURL through `new URL(...)` internally, so
 * a relative path like `/api/auth` throws ERR_INVALID_URL under
 * Node (SSR). Concretely:
 *
 * - Browser: `window.location.origin + '/api/auth'` goes through
 *   the TanStack Start server file route proxy (src/routes/api.$.ts)
 *   to apps/api on :3000, keeping requests same-origin so Better-Auth
 *   cookies and CSRF checks work unmodified.
 * - SSR (Nitro/Node): no `window`; must resolve to an absolute URL
 *   that Node can reach directly. The proxy is irrelevant in SSR
 *   context because Node calls the API directly. VITE_API_URL is
 *   the canonical override; the localhost fallback matches the
 *   default apps/api PORT.
 */
const isBrowser = typeof window !== 'undefined';

const apiOrigin = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';

const baseURL = isBrowser
  ? `${window.location.origin}/api/auth`
  : `${apiOrigin}/api/auth`;

export const authClient = createAuthClient({
  baseURL,
  plugins: authClientPlugins,
});

export type AuthClient = typeof authClient;
