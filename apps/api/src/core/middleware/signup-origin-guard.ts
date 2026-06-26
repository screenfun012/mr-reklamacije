import type { Context, MiddlewareHandler } from 'hono'

import { ForbiddenError } from '../errors/domain-errors.js'

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, '')
}

/** Origin from Origin header, or derived from Referer when Origin is absent. */
export function resolveRequestOrigin(c: Context): string | null {
  const originHeader = c.req.header('origin')
  if (originHeader !== undefined && originHeader.trim() !== '') {
    return normalizeOrigin(originHeader.trim())
  }

  const referer = c.req.header('referer')
  if (referer === undefined || referer.trim() === '') {
    return null
  }

  try {
    return normalizeOrigin(new URL(referer).origin)
  } catch {
    return null
  }
}

/**
 * Restricts employee self-signup to known internal-web origins (e.g. :3002).
 * Admin/portal origins receive 403 before Better-Auth handles the request.
 */
export function createSignupOriginGuard(allowedOrigins: readonly string[]): MiddlewareHandler {
  const allowed = new Set(allowedOrigins.map(normalizeOrigin))

  return async (c, next) => {
    const origin = resolveRequestOrigin(c)
    if (origin === null || !allowed.has(origin)) {
      throw new ForbiddenError('Registracija nije dozvoljena sa ovog izvora.')
    }

    await next()
  }
}
