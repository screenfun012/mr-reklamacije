import { createFileRoute, Outlet } from '@tanstack/react-router'

import { portalRequireRoles } from '~/lib/auth-guard'
import { usePortalEventStream } from '~/lib/use-portal-event-stream'

/**
 * Layout route: role guard for everything under /claims (dashboard + detail).
 * The SSE stream mounts here so it survives navigations within the portal —
 * one connection per session, same pattern as the internal shell.
 */
export const Route = createFileRoute('/claims')({
  beforeLoad: portalRequireRoles(['client', 'admin']),
  component: ClaimsLayout,
})

function ClaimsLayout(): React.ReactElement {
  usePortalEventStream()
  return <Outlet />
}
