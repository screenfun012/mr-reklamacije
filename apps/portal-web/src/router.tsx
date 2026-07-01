import { RouteNotFound } from '@mr/ui'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { createQueryClient } from '~/lib/query-client'
import type { PortalRouterContext } from '~/router-context'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = createQueryClient()

  const router = createRouter({
    routeTree,
    context: { queryClient } as PortalRouterContext,
    defaultNotFoundComponent: RouteNotFound,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    wrapQueryClient: true,
  })

  return router
}
