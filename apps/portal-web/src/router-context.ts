import type { AuthRouterContext } from '@mr/auth/route-guards'
import type { QueryClient } from '@tanstack/react-query'

export interface PortalRouterContext extends AuthRouterContext {
  queryClient: QueryClient
}
