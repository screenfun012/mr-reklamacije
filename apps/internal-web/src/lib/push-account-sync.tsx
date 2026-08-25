import { useAuthSession } from '@mr/auth/route-guards'
import { useEffect } from 'react'

import { syncServiceWorkerPushUser } from './register-service-worker.js'

/** Keeps the worker fail-closed on login, logout, session expiry, and session revocation. */
export function PushAccountSync(): null {
  const { session, isPending } = useAuthSession()
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!isPending) {
      void syncServiceWorkerPushUser(userId)
    }
  }, [isPending, userId])

  return null
}
