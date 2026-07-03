import { createFileRoute, Outlet } from '@tanstack/react-router'

import { InternalShell } from '~/components/layout/internal-shell'

export const Route = createFileRoute('/_shell')({
  component: ShellLayout,
})

/**
 * Pathless layout route: keeps the app shell (sidebar, topbar and the
 * SSE event stream mounted by InternalShell) alive across navigations
 * between authenticated pages. Auth guards stay on the child routes
 * because they differ per page.
 */
function ShellLayout(): React.ReactElement {
  return (
    <InternalShell>
      <Outlet />
    </InternalShell>
  )
}
