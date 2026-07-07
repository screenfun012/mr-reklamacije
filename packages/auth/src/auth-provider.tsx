import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'

import type { MRAuthClientForPermissions } from './auth-client-types.js'
import { setClientSession } from './client-session-store.js'
import {
  resolveSessionPayload,
  toSerializableAuthSession,
  type SerializableAuthSession,
} from './session-payload.js'

export type AuthContextValue = {
  session: SerializableAuthSession | null
  roles: readonly string[]
  permissions: readonly string[]
  isPending: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Single client-side session source for an app.
 *
 * Subscribes to the one shared Better-Auth session atom (via `useSession`) and:
 * 1. exposes it to the whole tree through context (so components never fetch), and
 * 2. bridges the settled session into the client-session store, which the router's
 *    root `beforeLoad` reads instead of calling `getSession()` per navigation.
 *
 * The net effect is that navigating the app no longer floods `/get-session`.
 */
export function AuthProvider({
  authClient,
  children,
}: {
  authClient: MRAuthClientForPermissions
  children: ReactNode
}): ReactNode {
  const { data, isPending, isRefetching } = authClient.useSession()
  const isSettled = !isPending && isRefetching !== true

  const session = useMemo(() => toSerializableAuthSession(resolveSessionPayload({ data })), [data])

  useEffect(() => {
    // Publish only once settled — a pending/refetching state must not read as a
    // logout to the router guards. Until the first settle, beforeLoad falls back
    // to its one-off network fetch (unchanged behavior), so login can't break.
    if (isSettled) {
      setClientSession(session)
    }
  }, [isSettled, session])

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
