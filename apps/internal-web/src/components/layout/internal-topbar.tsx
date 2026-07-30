import { m } from '@mr/i18n'
import { useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'

import { InternalLogo } from '~/components/masked-icon'
import { LocaleThemeControls } from './locale-theme-controls'
import { InternalUserChip } from './internal-user-chip'
import { NotificationBell } from '~/features/notifications/notification-bell'

function sectionLabel(pathname: string): string {
  if (pathname.startsWith('/reklamacije')) {
    return m.nav_reklamacije()
  }
  if (pathname.startsWith('/statistika')) {
    return m.nav_statistika()
  }
  if (pathname.startsWith('/pristiglo')) {
    return m.nav_pristiglo()
  }
  if (pathname.startsWith('/prijem')) {
    return m.nav_servis()
  }
  if (pathname.startsWith('/settings')) {
    return m.nav_security()
  }
  return m.nav_pocetna()
}

/**
 * Full-width sticky header: logo + app name (always visible), the current
 * section, and the EN/SR + theme controls. Spans the whole app so the brand
 * stays present even when the sidebar scrolls or (later) collapses.
 */
export interface InternalTopbarProps {
  onToggleSidebar: () => void
  /**
   * When there is no sidebar to open (a user with a single visible nav entry), the ☰ has
   * nothing to toggle and the user block moves up here instead — otherwise that user would
   * have no way to sign out (docs/25 §3.1).
   */
  showSidebarToggle: boolean
  user?: {
    userName: string
    userEmail: string
    roleLabel: string | undefined
    onLogout: () => void
  }
}

export function InternalTopbar({ onToggleSidebar, showSidebarToggle, user }: InternalTopbarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <header className="sticky top-0 z-30 border-b border-mri-border bg-mri-hdr backdrop-blur-[14px]">
      {/* Inner row = the occupied height minus this header's own 1px bottom border, so
          --mri-topbar-h stays the single number everything else offsets against. */}
      <div className="flex h-[calc(var(--mri-topbar-h)-1px)] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {showSidebarToggle ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={m.nav_menu()}
            className="grid size-9 flex-none place-items-center rounded-[9px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-text"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        ) : null}
        <div className="flex items-center gap-2.5">
          <InternalLogo className="h-[30px] w-[113px]" />
          <span className="hidden font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-mri-text2 sm:inline">
            {m.internal_app_eyebrow()}
          </span>
        </div>
        <span aria-hidden="true" className="hidden h-5 w-px bg-mri-border sm:block" />
        {/*
          Hidden below `sm` like the eyebrow and the divider beside it. It is the one item in
          this row that neither shrinks nor wraps, and at phone width it pushed the whole
          header past the viewport — the page scrolled sideways on every screen (measured
          2026-07-26: 64px over on /reklamacije). The page's own H1 says the same thing.
        */}
        <span className="hidden font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mri-text2 sm:inline">
          {sectionLabel(pathname)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell />
          <LocaleThemeControls />
          {user !== undefined ? (
            <>
              <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-mri-border sm:block" />
              <InternalUserChip {...user} />
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
