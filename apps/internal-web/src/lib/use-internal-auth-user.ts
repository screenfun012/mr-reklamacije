import { getRouteApi } from '@tanstack/react-router'

import { authClient } from '~/lib/auth-client'

const rootRoute = getRouteApi('__root__')

export interface InternalAuthUser {
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

  return { userName, userEmail }
}
