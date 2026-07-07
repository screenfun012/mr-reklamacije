import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

import type { MRAuthClientForPermissions } from './auth-client-types.js'
import { setClientSession } from './client-session-store.js'
import {
  resolveSessionPayload,
  toSerializableAuthSession,
  type SerializableAuthSession,
} from './session-payload.js'
import { handleUnauthorizedSession } from './unauthorized-session.js'

export type AuthContextValue = {
  session: SerializableAuthSession | null
  roles: readonly string[]
  permissions: readonly string[]
  isPending: boolean
}

/** AuthProvider needs `signOut` too (to kick a revoked tab), so widen the client. */
type AuthProviderClient = MRAuthClientForPermissions & {
  signOut: () => Promise<unknown>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Single client-side session source for an app.
 *
 * Subscribes to the one shared Better-Auth session atom (via `useSession`) and:
 * 1. exposes it to the whole tree through context (so components never fetch),
 * 2. bridges the settled session into the client-session store, which the router's
 *    root `beforeLoad` reads instead of calling `getSession()` per navigation, and
 * 3. kicks the tab to /login the moment the session goes from signed-in to
 *    signed-out — e.g. when single-device revokes this session from another
 *    login — instead of leaving a dead, stale UI.
 */
export function AuthProvider({
  authClient,
  children,
}: {
  authClient: AuthProviderClient
  children: ReactNode
}): ReactNode {
  const { data, isPending, isRefetching } = authClient.useSession()
  const isSettled = !isPending && isRefetching !== true

  const session = useMemo(() => toSerializableAuthSession(resolveSessionPayload({ data })), [data])

  const wasAuthedRef = useRef(false)

  useEffect(() => {
    // Only act on a settled state — a pending/refetching state must never read
    // as a logout to the router guards or trigger a false redirect. Until the
    // first settle, beforeLoad falls back to its one-off fetch, so login can't
    // break. Better-Auth keeps the previous session on non-401 errors, so a
    // network blip cannot produce a false signed-out transition here.
    if (!isSettled) return

    setClientSession(session)

    const isAuthed = session?.user != null
    if (wasAuthedRef.current && !isAuthed) {
      // Signed-in → signed-out: session was revoked or expired. Sign out locally
      // and redirect to /login (idempotent) instead of showing a dead UI.
      handleUnauthorizedSession(() => authClient.signOut())
    }
    wasAuthedRef.current = isAuthed
  }, [isSettled, session, authClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      roles: session?.user?.roles ?? [],
      permissions: session?.user?.permissions ?? [],
      isPending: !isSettled,
    }),
    [session, isSettled],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthSession(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuthSession must be used within <AuthProvider>')
  }
  return ctx
}
