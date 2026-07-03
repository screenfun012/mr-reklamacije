import { createFileRoute, Outlet } from '@tanstack/react-router'

import { portalRequireRoles } from '~/lib/auth-guard'

/** Layout route: role guard for everything under /claims (dashboard + detail). */
export const Route = createFileRoute('/claims')({
  beforeLoad: portalRequireRoles(['client', 'admin']),
  component: Outlet,
})
