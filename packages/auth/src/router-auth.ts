import type { Locale } from '@mr/i18n'
import { getLocale, syncRequestLocale } from '@mr/i18n'
import type { MRAuthClientForRouteRoles } from './auth-client-types.js'
import {
  resolveSessionPayload,
  toSerializableAuthSession,
  type AuthSessionPayload,
  type SerializableAuthSession,
} from './session-payload.js'

/** Root route staleTime — session context is not re-fetched on tab focus. */
export const SESSION_ROUTE_STALE_MS = 300_000

export type AuthRouterContext = {
  authSession?: SerializableAuthSession | null
  locale?: Locale
}

export type RouteBeforeLoadArgs = {
  context: AuthRouterContext
}

export type ServerSessionLoader = () => Promise<unknown>

function isBrowser(): boolean {
  const g = globalThis as typeof globalThis & { window?: unknown }
  return typeof g.window !== 'undefined'
}

/**
 * Root `beforeLoad` — loads session once per navigation (respects route `staleTime`).
 * Tab visibility changes do not re-run `beforeLoad`, so session stays stable across tab switches.
 */
export function createRootAuthBeforeLoad(
  authClient: MRAuthClientForRouteRoles,
  loadServerSession?: ServerSessionLoader,
): () => Promise<{ authSession: SerializableAuthSession | null; locale: Locale }> {
  return async () => {
    const onServer = !isBrowser()

    if (onServer) {
      await syncRequestLocale()
    }

    if (onServer && !loadServerSession) {
      return { authSession: null, locale: getLocale() }
    }

    try {
      const raw = onServer ? await loadServerSession!() : await authClient.getSession()
      return {
        authSession: toSerializableAuthSession(resolveSessionPayload(raw)),
        locale: getLocale(),
      }
    } catch {
      // Network/API unavailable — treat as unauthenticated so public routes (e.g. /login) still render.
      return { authSession: null, locale: getLocale() }
    }
  }
}

/**
 * Resolves session for route guards. On the client, uses settled router context only —
 * never refetches (avoids false logout during Better-Auth focus refresh).
 */
export async function resolveAuthSessionForGuard(
  args: RouteBeforeLoadArgs,
  authClient: MRAuthClientForRouteRoles,
  loadServerSession?: ServerSessionLoader,
): Promise<AuthSessionPayload | null> {
  const onServer = !isBrowser()

  if (!onServer) {
    const ctxSession = args.context.authSession
    if (!ctxSession?.user) return null
    return { user: { roles: ctxSession.user.roles, permissions: ctxSession.user.permissions } }
  }

  if (args.context.authSession !== undefined) {
    const ctxSession = args.context.authSession
    if (!ctxSession?.user) return null
    return { user: { roles: ctxSession.user.roles, permissions: ctxSession.user.permissions } }
  }

  if (!loadServerSession) {
    return null
  }

  const raw = await loadServerSession()
  return resolveSessionPayload(raw)
}
