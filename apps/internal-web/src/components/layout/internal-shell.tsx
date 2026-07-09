import { useSidebarState } from '@mr/ui'
import { useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { MaskedIcon } from '~/components/masked-icon'
import { authClient } from '~/lib/auth-client'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'
import { useRealtimeEventStream } from '~/lib/use-realtime-event-stream'

import { InternalSidebar } from './internal-sidebar'
import { InternalTopbar } from './internal-topbar'

export interface InternalShellProps {
  children: ReactNode
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
export function InternalShell({ children }: InternalShellProps) {
  useRealtimeEventStream()
  const navigate = useNavigate()
  const { userEmail, userName } = useInternalAuthUser()
  const { collapsed, mobileOpen, onToggle, onCloseMobile } = useSidebarState(
    'mrr:internal:sidebar-collapsed',
  )

  const handleLogout = (): void => {
    void (async () => {
      await authClient.signOut()
      await navigate({ to: '/login' })
    })()
  }

  return (
    <div className="flex min-h-screen flex-col bg-mri-bg font-sans text-mri-text">
      <InternalTopbar onToggleSidebar={onToggle} />

      <div className="flex flex-1 items-stretch">
        <InternalSidebar
          userName={userName}
          userEmail={userEmail}
          onLogout={handleLogout}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={onCloseMobile}
        />

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
