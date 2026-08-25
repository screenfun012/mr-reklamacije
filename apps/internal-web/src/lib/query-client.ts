import { handleUnauthorizedSession } from '@mr/auth/route-guards'
import { createAppQueryClient } from '@mr/shared'
import type { QueryClient } from '@tanstack/react-query'

import { authClient } from './auth-client'
import { syncServiceWorkerPushUser } from './register-service-worker'

export function createQueryClient(): QueryClient {
  return createAppQueryClient(() => {
    handleUnauthorizedSession(async () => {
      await syncServiceWorkerPushUser(null)
      return authClient.signOut()
    })
  })
}
