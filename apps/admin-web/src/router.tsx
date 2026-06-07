import { createRouter } from '@tanstack/react-router'

import type { AdminRouterContext } from '~/router-context'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    context: {} as AdminRouterContext,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}
