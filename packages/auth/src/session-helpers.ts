import type { Auth } from './better-auth.config.js'
import { UnauthorizedError } from './unauthorized-error.js'

/**
 * Session helpers for consuming Better-Auth from different contexts.
 * Takes a Fetch-API Request (works with Hono via c.req.raw).
 *
 * requirePermission is NOT here — it belongs in apps/api as Hono
 * middleware (per docs/04-modules.md line 144-145).
 */
export async function getSession(auth: Auth, request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  })
}

export async function requireSession(auth: Auth, request: Request) {
  const session = await getSession(auth, request)
  if (!session) {
    throw new UnauthorizedError('No active session')
  }
  return session
}

export async function getCurrentUser(auth: Auth, request: Request) {
  const session = await getSession(auth, request)
  return session?.user ?? null
}
