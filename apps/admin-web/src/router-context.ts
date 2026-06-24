import type { AuthRouterContext } from '@mr/auth/route-guards'
import type { QueryClient } from '@tanstack/react-query'

export interface AdminRouterContext extends AuthRouterContext {
  queryClient: QueryClient
}
