import { m } from '@mr/i18n'
import { MrEnginesLogo } from '@mr/ui'
import { useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import type { ReactElement } from 'react'

import { adminNavItems } from '~/config/navigation'
import { useTheme } from '~/lib/theme'
import { LocaleThemeControls } from './locale-theme-controls'

/**
 * Reads the section name off the navigation itself — longest matching path wins — instead of the
 * hand-written if-chain internal-web uses. A screen reachable from the sidebar can then never be
 * added without its name reaching the bar, which is the only way that chain goes stale.
 *
 * `/settings/security` is the one screen with no sidebar entry (it is reached from the user block),
 * so it is named here.
 */
export function sectionLabel(pathname: string): string {
  if (pathname === '/') {
    return m.nav_dashboard()
  }
  if (pathname.startsWith('/settings/security')) {
    return m.nav_security()
  }

  // Longest path wins, and that is the only rule needed: '/' prefixes everything, but it is also
  // the shortest, so it can never outrank a real section. (An explicit `item.to !== '/'` filter
  // stood here until a mutation proved the sort already covered it — the test stayed green with the
  // filter removed.)
  const match = [...adminNavItems]
    .filter((item) => pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0]

  return match?.label() ?? m.nav_dashboard()
}

export interface AdminTopbarProps {
  onToggleSidebar: () => void
}

/**
 * Admin top bar: ☰ + brand, the ADMIN chip and the current section on the left, EN/SR + theme on
 * the right.
 *
 * The chip and the mono breadcrumb are the prototype's (`admin-prototip.dc.html`); they replace two
 * hairline dividers and a spelled-out "ADMINISTRACIJA", which cost three times the width to say the
 * same thing. The user block lives at the foot of the sidebar, where internal-web has kept it all
 * along.
 */
export function AdminTopbar({ onToggleSidebar }: AdminTopbarProps): ReactElement {
  const { resolvedTheme } = useTheme()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <div className="flex h-full items-center gap-3.5 px-4 sm:px-[18px]">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={m.nav_menu()}
        className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-mr-list-item-hover hover:text-foreground"
      >
        <Menu className="size-[17px]" aria-hidden="true" />
      </button>
      <span className="flex items-center gap-2.5">
        <MrEnginesLogo theme={resolvedTheme} className="h-6 w-auto" />
        <span className="rounded-md bg-mr-brand/[0.13] px-2 py-[3px] font-mono text-[9px] font-bold tracking-[0.14em] text-adm-red-h">
          {m.admin_app_chip()}
        </span>
      </span>
      {/* Hidden below `sm`: it neither shrinks nor wraps, and the page's own H1 says the same. */}
      <span className="hidden truncate font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:block">
        <span aria-hidden="true" className="opacity-50">
          /
        </span>{' '}
        {sectionLabel(pathname)}
      </span>
      <div className="ml-auto">
        <LocaleThemeControls />
      </div>
    </div>
  )
}
