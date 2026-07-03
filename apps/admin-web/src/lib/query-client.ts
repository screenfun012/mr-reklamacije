import { handleUnauthorizedSession } from '@mr/auth/route-guards'
import { createAppQueryClient } from '@mr/shared'
import type { QueryClient } from '@tanstack/react-query'

import { authClient } from './auth-client'

export function createQueryClient(): QueryClient {
  return createAppQueryClient(() => {
    handleUnauthorizedSession(() => authClient.signOut())
  })
}
