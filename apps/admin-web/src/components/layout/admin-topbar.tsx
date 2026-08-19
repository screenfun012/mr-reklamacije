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
 * Admin top bar: ☰ + brand and the current section on the left, EN/SR + theme on the right.
 *
 * The user block moved OUT of here and down to the foot of the sidebar, where internal-web has kept
 * it all along — so logout, the security screen and who-am-I sit in the same corner in both apps.
 */
export function AdminTopbar({ onToggleSidebar }: AdminTopbarProps): ReactElement {
  const { resolvedTheme } = useTheme()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <div className="flex h-full items-center gap-3 px-4 sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={m.nav_menu()}
        className="grid size-9 flex-none place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <MrEnginesLogo theme={resolvedTheme} className="h-7 w-auto" />
      <span aria-hidden="true" className="hidden h-4 w-px flex-none bg-mr-border-strong sm:block" />
      <span className="hidden whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:block">
        {m.admin_app_eyebrow()}
      </span>
      <span aria-hidden="true" className="hidden h-4 w-px flex-none bg-mr-border-strong md:block" />
      <span className="hidden truncate font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:block">
        {sectionLabel(pathname)}
      </span>
      <div className="ml-auto">
        <LocaleThemeControls />
      </div>
    </div>
  )
}
