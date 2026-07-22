import { useSidebarState } from '@mr/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { authClient } from '~/lib/auth-client'
import { useRealtimeEventStream } from '~/lib/use-realtime-event-stream'

import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'

export interface AdminShellProps {
  children: ReactNode
}

/**
 * Admin app shell: a full-width sticky header (☰ toggle + brand + user menu) on
 * top, with the collapsible sidebar and main area below it — mirroring the
 * internal app. Collapsible-sidebar state (desktop icon rail, mobile drawer)
 * lives in the shared `useSidebarState` hook.
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 h-[60px] flex-none border-b border-border bg-background">
        <AdminTopbar
          userEmail={userEmail}
          userName={userName}
          onLogout={handleLogout}
          onToggleSidebar={onToggle}
        />
      </header>

      <div className="flex flex-1 items-stretch">
        <AdminSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={onCloseMobile} />
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
