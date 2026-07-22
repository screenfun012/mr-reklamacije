import { createFileRoute, Outlet } from '@tanstack/react-router'

import { InternalShell } from '~/components/layout/internal-shell'
import { CommandPalette } from '~/features/command-palette/command-palette'
import { NotificationPopups } from '~/features/notifications/notification-popups'
import { NotificationsUiProvider } from '~/features/notifications/notifications-context'

export const Route = createFileRoute('/_shell')({
  component: ShellLayout,
})

/**
 * Pathless layout route: keeps the app shell (sidebar, topbar and the
 * SSE event stream mounted by InternalShell) alive across navigations
 * between authenticated pages. Auth guards stay on the child routes
 * because they differ per page.
 *
 * The notifications provider wraps the shell so the bell (in the topbar) and the
 * popup stack share one "is the panel open" flag.
 */
function ShellLayout(): React.ReactElement {
  return (
    <NotificationsUiProvider>
      <InternalShell>
        <CommandPalette />
        <NotificationPopups />
        <Outlet />
      </InternalShell>
    </NotificationsUiProvider>
  )
}
