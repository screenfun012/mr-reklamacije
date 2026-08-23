import { m } from '@mr/i18n'
import { useSidebarState } from '@mr/ui'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useCallback, type ReactNode } from 'react'

import { MaskedIcon } from '~/components/masked-icon'
import { filterVisibleNavItems, internalNavItems } from '~/config/navigation'
import { authClient } from '~/lib/auth-client'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'
import { useRealtimeEventStream } from '~/lib/use-realtime-event-stream'
import { SIDEBAR_COLLAPSED_COOKIE, writeUiFlagCookie, type InternalUiPrefs } from '~/lib/ui-prefs'

import { InternalSidebar } from './internal-sidebar'
import { InternalTopbar } from './internal-topbar'

const rootRoute = getRouteApi('__root__')

const ROLE_LABELS: Record<string, () => string> = {
  admin: m.users_role_admin,
  operator: m.users_role_operator,
  viewer: m.users_role_viewer,
  client: m.users_role_client,
  serviser: m.users_role_serviser,
}

export interface InternalShellProps {
  children: ReactNode
  /** The layout choices the SERVER rendered this request with — see `~/lib/ui-prefs`. */
  ui: InternalUiPrefs
}

/**
 * Internal app shell ("MR Interna" redesign): a full-width sticky header (brand
 * + section + controls + the ☰ toggle) on top, with the sidebar and main area
 * below it. Collapsible-sidebar state (desktop icon rail, mobile drawer) lives
 * in the shared `useSidebarState` hook. The main column carries the
 * blueprint-grid texture and the slow rotating cog watermark; `overflow-x: clip`
 * (NOT hidden) contains the offscreen cog without creating a scroll container,
 * so the sticky header/sidebar keep working against the page scroll.
 */
export function InternalShell({ children, ui }: InternalShellProps) {
  useRealtimeEventStream()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { userEmail, userName } = useInternalAuthUser()
  const { authSession } = rootRoute.useRouteContext()
  // The cookie the server read this request with, and where a new choice goes — one value, one
  // place, so the shell the browser hydrates is the shell the server drew (see `ui-prefs`).
  const { collapsed, mobileOpen, onToggle, onCloseMobile } = useSidebarState(
    SIDEBAR_COLLAPSED_COOKIE,
    {
      initialCollapsed: ui.sidebarCollapsed,
      persist: useCallback(
        (next: boolean) => writeUiFlagCookie(SIDEBAR_COLLAPSED_COOKIE, next),
        [],
      ),
    },
  )

  const visibleItems = filterVisibleNavItems(internalNavItems, authSession?.user?.permissions ?? [])
  /**
   * Nothing to navigate between means no sidebar — a serviser gets the topbar and his one
   * screen, nothing else (docs/25 §3.1). Derived from permissions rather than a role name, so
   * granting that person access to something else makes the sidebar appear on its own.
   */
  const showSidebar = visibleItems.length > 1
  const roleLabel = (authSession?.user?.roles ?? [])
    .map((role) => ROLE_LABELS[role])
    .find((label) => label !== undefined)

  const handleLogout = (): void => {
    void (async () => {
      await authClient.signOut()
      // Client-side navigation keeps the cache alive — on a shared workshop
      // computer the next person to sign in would briefly see the previous
      // user's claims and dashboard until each query refetched.
      queryClient.clear()
      await navigate({ to: '/login' })
    })()
  }

  return (
    <div className="flex min-h-screen flex-col bg-mri-bg font-sans text-mri-text">
      <InternalTopbar
        onToggleSidebar={onToggle}
        showSidebarToggle={showSidebar}
        {...(showSidebar
          ? {}
          : {
              user: {
                userName,
                userEmail,
                roleLabel: roleLabel === undefined ? undefined : roleLabel(),
                onLogout: handleLogout,
              },
            })}
      />

      <div className="flex flex-1 items-stretch">
        {showSidebar ? (
          <InternalSidebar
            items={visibleItems}
            userName={userName}
            userEmail={userEmail}
            onLogout={handleLogout}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            claimsNavOpen={ui.claimsNavOpen}
            onCloseMobile={onCloseMobile}
          />
        ) : null}

        <div className="relative min-w-0 flex-1 overflow-x-clip">
          <div aria-hidden="true" className="mri-grid-bg mri-grid-fade-down absolute inset-0" />
          <MaskedIcon
            name="cog"
            spinning
            className="pointer-events-none absolute -right-[180px] top-10 size-[440px] text-mri-gear"
          />

          <main className="relative px-4 pb-[72px] pt-9 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
