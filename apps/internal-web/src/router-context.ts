import type { AuthRouterContext } from '@mr/auth/route-guards'
import type { QueryClient } from '@tanstack/react-query'

export interface InternalRouterContext extends AuthRouterContext {
  queryClient: QueryClient
}
