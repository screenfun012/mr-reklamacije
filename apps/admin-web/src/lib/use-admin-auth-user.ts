import { getRouteApi } from '@tanstack/react-router'

import { authClient } from '~/lib/auth-client'

const rootRoute = getRouteApi('__root__')

export interface AdminAuthUser {
  userId: string
  userName: string
  userEmail: string
}

/**
 * Who is signed in, for the shell, the dashboard greeting and the users screen.
 *
 * The router's `authSession` (settled in the root `beforeLoad`) is the BASE, and the live
 * Better-Auth session only refines it. That order is not a preference: `useSession()` alone
 * resolved differently on the server than on the client's first render, so the admin dashboard
 * shipped "Welcome, Claude Walk!" from SSR and rendered "Welcome, !" in the browser — a text
 * mismatch, which React answers by throwing the whole server tree away and rendering again
 * (found 2026-08-21, on every admin page load).
 *
 * Same helper the internal app has had for the same reason.
 */
export function useAdminAuthUser(): AdminAuthUser {
  const { authSession } = rootRoute.useRouteContext()
  const { data: liveSession } = authClient.useSession()

  const contextId = authSession?.user?.id ?? ''
  const contextEmail = authSession?.user?.email ?? ''
  const contextName = authSession?.user?.name ?? ''

  const liveId = typeof liveSession?.user?.id === 'string' ? liveSession.user.id : ''
  const liveEmail = typeof liveSession?.user?.email === 'string' ? liveSession.user.email : ''
  const liveName = typeof liveSession?.user?.name === 'string' ? liveSession.user.name : ''

  const userId = liveId || contextId
  const userEmail = liveEmail || contextEmail
  const userName = liveName || contextName || userEmail

  return { userId, userName, userEmail }
}
