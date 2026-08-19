import { usersListOptions } from '@mr/shared'
import { useSidebarState } from '@mr/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { authClient } from '~/lib/auth-client'
import { countUsersByStatus } from '~/lib/dashboard-user-counts'
import { useRealtimeEventStream } from '~/lib/use-realtime-event-stream'

import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'

export interface AdminShellProps {
  children: ReactNode
}

/**
 * Admin app shell: a full-width sticky header (☰ toggle, brand, current section, EN/SR + theme) on
 * top, with the collapsible sidebar and main area below it — mirroring the internal app, including
 * where the user block sits: at the FOOT OF THE SIDEBAR, not in the bar. Collapsible-sidebar state
 * (desktop icon rail, mobile drawer) lives in the shared `useSidebarState` hook.
 *
 * User data comes from `authClient.useSession()`; during the first SSR render
 * the hook returns `data: undefined`, so the user fields are briefly blank until
 * the browser hydrates.
 */
export function AdminShell({ children }: AdminShellProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  useRealtimeEventStream()
  const { collapsed, mobileOpen, onToggle, onCloseMobile } = useSidebarState(
    'mrr:admin:sidebar-collapsed',
  )
  /*
   * The count on "Korisnici". Not a suspense query and not in a loader: the shell must draw on
   * every screen, and the menu is not worth blocking one on. It is the SAME query key the users
   * screen and the dashboard already use, so on those two screens this costs nothing at all.
   */
  const { data: users } = useQuery(usersListOptions())
  const pendingUserCount = users === undefined ? 0 : countUsersByStatus(users).pendingApproval

  const handleLogout = (): void => {
    void (async () => {
      await authClient.signOut()
      // Client-side navigation keeps the cache alive — the next admin to sign
      // in on the same machine would briefly see the previous one's data.
      queryClient.clear()
      await navigate({ to: '/login' })
    })()
  }

  const userEmail = session?.user.email ?? ''
  const userName = session?.user.name ?? userEmail

  return (
    // `adm-grid` is the 56px graph-paper the prototype draws behind everything. It sits on the page
    // itself rather than on a positioned overlay, so no element has to opt out of pointer events.
    <div className="adm-grid flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 h-[60px] flex-none border-b border-border bg-adm-hdr backdrop-blur-[14px]">
        <AdminTopbar onToggleSidebar={onToggle} />
      </header>

      <div className="flex flex-1 items-stretch">
        <AdminSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={onCloseMobile}
          userName={userName}
          userEmail={userEmail}
          onLogout={handleLogout}
          pendingUserCount={pendingUserCount}
        />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 sm:py-6">{children}</main>
      </div>
    </div>
  )
}
