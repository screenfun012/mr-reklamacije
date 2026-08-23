import { SYSTEM_ROLE_ADMIN } from '@mr/shared'
import { getRouteApi } from '@tanstack/react-router'

import { authClient } from '~/lib/auth-client'

const rootRoute = getRouteApi('__root__')

export interface InternalAuthUser {
  /** Empty only before the session is resolved — used to tell your own messages from everybody's. */
  userId: string
  /** Read from the SAME session the server rendered with, like the name and the id. */
  isAdmin: boolean
  userName: string
  userEmail: string
}

/**
 * User display fields for shell/topbar/welcome.
 *
 * Prefer router `authSession` from root `beforeLoad` (stable across tab focus and
 * SSR). Fall back to Better-Auth `useSession()` when live client data arrives.
 */
export function useInternalAuthUser(): InternalAuthUser {
  const { authSession } = rootRoute.useRouteContext()
  const { data: liveSession } = authClient.useSession()

  const contextEmail = authSession?.user?.email ?? ''
  const contextName = authSession?.user?.name ?? ''

  const liveEmail = typeof liveSession?.user?.email === 'string' ? liveSession.user.email : ''
  const liveName = typeof liveSession?.user?.name === 'string' ? liveSession.user.name : ''

  const userEmail = liveEmail || contextEmail
  const userName = liveName || contextName || userEmail
  // ⚠ From the router context first, like the name: the live session resolves differently on the
  // server and on the first client render, and a value that differs across those two costs the
  // whole server tree (CLAUDE.md §5).
  const liveId = typeof liveSession?.user?.id === 'string' ? liveSession.user.id : ''
  const userId = authSession?.user?.id ?? liveId

  const isAdmin = (authSession?.user?.roles ?? []).includes(SYSTEM_ROLE_ADMIN)

  return { userId, isAdmin, userName, userEmail }
}
