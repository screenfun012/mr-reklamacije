import { claimCategoryCountsOptions, INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS } from '@mr/shared'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { InternalShell } from '~/components/layout/internal-shell'
import { CommandPalette } from '~/features/command-palette/command-palette'
import { NotificationPopups } from '~/features/notifications/notification-popups'
import { NotificationsUiProvider } from '~/features/notifications/notifications-context'
import { parseInternalUiPrefs, type InternalUiPrefs } from '~/lib/ui-prefs'

/**
 * The two layout choices, read from the request on the server and from the document in the
 * browser — the same cookies either way, so both sides render the same shell. See `ui-prefs`.
 *
 * ⚠ `createIsomorphicFn`, not a `typeof document` branch and not a dynamic import. The build
 * refuses `@tanstack/react-start/server` anywhere the client bundle can reach — including inside
 * an `await import(...)`, which is how this was first written and how it failed the build. This
 * is the sanctioned tool: the plugin drops the `.server` half, and its import with it, from the
 * browser build.
 *
 * ⚠ `.get('cookie')`, never `.cookie`. `getRequestHeaders()` hands back a `TypedHeaders`, whose
 * index signature accepts the property read and answers `undefined` — so the first version of
 * this typechecked, built, and fell through to the defaults on every request. The measurement
 * looked perfect because nothing was happening: the rail never collapsed at all, so of course it
 * never jumped. A number that improves because the feature stopped working is the failure this
 * whole change is about; the probe is the SERVER's html (`lg:w-[60px]` vs `lg:w-[236px]`), not
 * the shift score.
 */
const readUiPrefs = createIsomorphicFn()
  .client((): InternalUiPrefs => parseInternalUiPrefs(document.cookie))
  .server((): InternalUiPrefs => parseInternalUiPrefs(getRequestHeaders().get('cookie') ?? ''))

export const Route = createFileRoute('/_shell')({
  beforeLoad: () => ({ ui: readUiPrefs() }),
  /**
   * ⚠ AWAITED, not fire-and-forget. It used to be `void prefetchQuery(...)` so a slow count could
   * never take the menu down — but that left the server rendering the claims group with only
   * „Sve reklamacije" in it, and the browser adding four categories a moment later: **128px** of
   * menu appearing under the cursor on every single load, and the reason `useHydrated` had to
   * exist here at all.
   *
   * The `catch` keeps the original promise: a count that FAILS still cannot take the menu down —
   * both sides then simply render the short group and agree about it. A count that is merely slow
   * now delays the shell, and that is the trade: measured at 24 ms median through the dev proxy,
   * less on the server's own network.
   *
   * A serviser holds no claims permission and would get a 403, so nothing is asked for him.
   */
  loader: async ({ context: { queryClient, authSession } }) => {
    const permissions = authSession?.user?.permissions ?? []
    if (
      INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS.some((permission) => permissions.includes(permission))
    ) {
      await queryClient.ensureQueryData(claimCategoryCountsOptions()).catch(() => undefined)
    }
  },
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
  const { ui } = Route.useRouteContext()

  return (
    <NotificationsUiProvider>
      <InternalShell ui={ui}>
        <CommandPalette />
        <NotificationPopups />
        <Outlet />
      </InternalShell>
    </NotificationsUiProvider>
  )
}
