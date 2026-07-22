import { m } from '@mr/i18n'
import { useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'

import { InternalLogo } from '~/components/masked-icon'
import { LocaleThemeControls } from './locale-theme-controls'
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
}

export function InternalTopbar({ onToggleSidebar }: InternalTopbarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <header className="sticky top-0 z-30 border-b border-mri-border bg-mri-hdr backdrop-blur-[14px]">
      <div className="flex h-[58px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={m.nav_menu()}
          className="grid size-9 flex-none place-items-center rounded-[9px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-text"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2.5">
          <InternalLogo className="h-[30px] w-[113px]" />
          <span className="hidden font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-mri-text2 sm:inline">
            {m.internal_app_eyebrow()}
          </span>
        </div>
        <span aria-hidden="true" className="hidden h-5 w-px bg-mri-border sm:block" />
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mri-text2">
          {sectionLabel(pathname)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell />
          <LocaleThemeControls />
        </div>
      </div>
    </header>
  )
}
