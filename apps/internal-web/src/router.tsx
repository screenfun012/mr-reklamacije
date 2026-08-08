import { RouteError, RouteNotFound } from '@mr/ui'
import { createRouter, useRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { createQueryClient } from '~/lib/query-client'

import { routeTree } from './routeTree.gen'

/**
 * The app's default error box. It supplies the retry itself because the `reset` the router passes an
 * `errorComponent` cannot do the job — see `RouteError` — and `invalidate()` needs a router instance
 * from this app, not from inside `@mr/ui`.
 */
function DefaultRouteError() {
  const router = useRouter()

  return (
    <RouteError
      onRetry={() => {
        void router.invalidate()
      }}
    />
  )
}

export function getRouter() {
  const queryClient = createQueryClient()

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultNotFoundComponent: RouteNotFound,
    defaultErrorComponent: DefaultRouteError,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPreloadDelay: 100,
    scrollRestoration: true,
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    wrapQueryClient: true,
  })

  return router
}
