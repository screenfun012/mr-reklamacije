import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { MaskedIcon } from '~/components/masked-icon'
import { useIsBreakpoint } from '~/hooks/use-is-breakpoint'
import { authClient } from '~/lib/auth-client'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'
import { useRealtimeEventStream } from '~/lib/use-realtime-event-stream'

import { InternalSidebar } from './internal-sidebar'
import { InternalTopbar } from './internal-topbar'

const SIDEBAR_COLLAPSED_KEY = 'mrr:internal:sidebar-collapsed'

export interface InternalShellProps {
  children: ReactNode
}

/**
 * Internal app shell ("MR Interna" redesign): a full-width sticky header (brand
 * + section + controls + the ☰ toggle) on top, with the sidebar and main area
 * below it. The toggle collapses the sidebar to an icon rail on desktop (lg+,
 * persisted) and opens it as an off-canvas drawer on mobile. The main column
 * carries the blueprint-grid texture and the slow rotating cog watermark;
 * `overflow-x: clip` (NOT hidden) contains the offscreen cog without creating a
 * scroll container, so the sticky header/sidebar keep working against the page
 * scroll.
 */
export function InternalShell({ children }: InternalShellProps) {
  useRealtimeEventStream()
  const navigate = useNavigate()
  const { userEmail, userName } = useInternalAuthUser()
  const isDesktop = useIsBreakpoint('min', 1024)

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
  }, [])

  // Growing past the mobile breakpoint must not leave the drawer state lingering.
  useEffect(() => {
    if (isDesktop) {
      setMobileOpen(false)
    }
  }, [isDesktop])

  const handleToggleSidebar = useCallback(() => {
    if (isDesktop) {
      setCollapsed((prev) => {
        const next = !prev
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
        return next
      })
    } else {
      setMobileOpen((prev) => !prev)
    }
  }, [isDesktop])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const handleLogout = (): void => {
    void (async () => {
      await authClient.signOut()
      await navigate({ to: '/login' })
    })()
  }

  return (
    <div className="flex min-h-screen flex-col bg-mri-bg font-sans text-mri-text">
      <InternalTopbar onToggleSidebar={handleToggleSidebar} />

      <div className="flex flex-1 items-stretch">
        <InternalSidebar
          userName={userName}
          userEmail={userEmail}
          onLogout={handleLogout}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={closeMobile}
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
