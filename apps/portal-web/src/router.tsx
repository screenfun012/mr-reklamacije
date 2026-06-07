import { RouteNotFound } from '@mr/ui'
import { createRouter } from '@tanstack/react-router'

import type { PortalRouterContext } from '~/router-context'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    context: {} as PortalRouterContext,
    defaultNotFoundComponent: RouteNotFound,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}
