import { APIError, createAuthMiddleware } from 'better-auth/api'

import {
  AUTH_ERROR_ACCOUNT_DEACTIVATED,
  AUTH_ERROR_ACCOUNT_LOCKED,
  AUTH_ERROR_ACCOUNT_PENDING,
  AUTH_ERROR_ACCOUNT_REJECTED,
} from '../auth-error-codes.js'
import type { LoginAttemptStore } from '../login-attempt-store.js'

const SIGN_IN_PATH = '/sign-in/email'
const SIGN_UP_PATH = '/sign-up/email'

/**
 * Failures that are NOT wrong-password attempts and must not count toward the
 * per-account lockout: the account is blocked for another reason (valid creds).
 */
const NON_CREDENTIAL_FAILURES = new Set<string>([
  AUTH_ERROR_ACCOUNT_PENDING,
  AUTH_ERROR_ACCOUNT_REJECTED,
  AUTH_ERROR_ACCOUNT_DEACTIVATED,
  AUTH_ERROR_ACCOUNT_LOCKED,
])

function emailFromBody(body: unknown): string | undefined {
  if (body !== null && typeof body === 'object' && 'email' in body) {
    const email = (body as { email?: unknown }).email
    if (typeof email === 'string') {
      return email
    }
  }
  return undefined
}

/** A failed sign-in counts toward lockout unless it is a non-credential block. */
function countsAsCredentialFailure(error: APIError): boolean {
  const message = (error.body as { message?: unknown } | undefined)?.message
  return typeof message !== 'string' || !NON_CREDENTIAL_FAILURES.has(message)
}

/** Strip the raw session token from a plain success-body object. */
function stripToken(returned: unknown): Record<string, unknown> | null {
  if (returned === null || typeof returned !== 'object' || returned instanceof APIError) {
    return null
  }
  const source = returned as Record<string, unknown>
  if (!('token' in source)) {
    return null
  }
  const stripped: Record<string, unknown> = { ...source }
  delete stripped['token']
  return stripped
}

/**
 * Better-Auth global hooks for email/password login:
 *  - `before`: reject a sign-in for an account that is currently locked
 *    (per-account brute-force protection, keyed by email — not IP, so shared
 *    office IPs don't collateral-block each other).
 *  - `after`: record success/failure into the lockout store, AND strip the raw
 *    session token from the sign-in/sign-up success body (defense in depth —
 *    the token belongs only in the httpOnly cookie, never in JS-readable JSON).
 *
 * Better-Auth allows exactly one global `before` and one global `after`, so both
 * concerns are composed here and each is guarded by `ctx.path`.
 */
export function createLoginLockoutHooks(store: LoginAttemptStore) {
  const before = createAuthMiddleware(async (ctx) => {
    if (ctx.path !== SIGN_IN_PATH) {
      return
    }
    const email = emailFromBody(ctx.body)
    if (email === undefined) {
      return
    }
    const lockedForSeconds = store.checkLocked(email)
    if (lockedForSeconds !== null) {
      throw new APIError(
        'TOO_MANY_REQUESTS',
        { message: AUTH_ERROR_ACCOUNT_LOCKED, code: AUTH_ERROR_ACCOUNT_LOCKED },
        { 'X-Retry-After': String(lockedForSeconds) },
      )
    }
  })

  const after = createAuthMiddleware(async (ctx) => {
    const path = ctx.path
    if (path !== SIGN_IN_PATH && path !== SIGN_UP_PATH) {
      return undefined
    }

    const returned = ctx.context.returned
    const failed = returned instanceof APIError

    // Lockout accounting — sign-in only.
    if (path === SIGN_IN_PATH) {
      const email = emailFromBody(ctx.body)
      if (email !== undefined) {
        if (failed) {
          if (countsAsCredentialFailure(returned)) {
            store.recordFailure(email)
          }
        } else {
          store.recordSuccess(email)
        }
      }
    }

    // Token strip — sign-in + sign-up success bodies.
    if (!failed) {
      const stripped = stripToken(returned)
      if (stripped !== null) {
        return ctx.json(stripped)
      }
    }

    return undefined
  })

  return { before, after }
}
