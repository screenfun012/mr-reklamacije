import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AdminShell } from '~/components/layout/admin-shell'
import { adminRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell')({
  beforeLoad: adminRequireRoles(['admin']),
  component: ShellLayout,
})

/**
 * Pathless layout route: keeps the app shell (sidebar, topbar and the
 * SSE event stream mounted by AdminShell) alive across navigations
 * between authenticated pages. Every authenticated admin route shares
 * the identical admin-only guard, so it lives here.
 */
function ShellLayout(): React.ReactElement {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
