import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { getRouteApi, Link, useLocation } from '@tanstack/react-router'
import { LogOut, Shield } from 'lucide-react'

import type { NavItem } from '~/config/navigation'
import { getInitials } from '@mr/shared'

const rootRoute = getRouteApi('__root__')

const SIDEBAR_LINK_ACTIVE_CLASSES = 'border-[rgba(237,28,36,.35)] bg-[rgba(237,28,36,.1)]'
const SIDEBAR_LINK_INACTIVE_CLASSES = 'border-transparent hover:bg-mri-rowhv'

const ROLE_LABELS: Record<string, () => string> = {
  admin: m.users_role_admin,
  operator: m.users_role_operator,
  viewer: m.users_role_viewer,
  client: m.users_role_client,
  serviser: m.users_role_serviser,
}

/**
 * Two entries can point at ONE route — "Mašinska obrada" is the claims list with a category
 * filter, not a screen of its own. TanStack calls a link active when its search is a SUBSET of
 * the URL's, so the plain "Reklamacije" entry (no search at all) lit up red on the filtered
 * list too, and two items glowed at once.
 *
 * The entry therefore declares `categoryCode: undefined` and asks for `explicitUndefined`, which
 * makes the ROUTER call it inactive whenever the URL carries any category — so `aria-current`
 * and `data-status` tell the truth, not just the colour. The one case that leaves behind is a
 * list filtered to some OTHER category from the filter control, where nothing would be lit at
 * all; `paintsAsActive` below puts the highlight back for it.
 *
 * Written generically: the sidebar knows nothing about categories, only about entries that share
 * a destination.
 */
/** An entry that actually narrows its screen, as opposed to one declaring the plain view. */
function isFilteredEntry(item: NavItem): boolean {
  return item.search !== undefined && Object.values(item.search).some((v) => v !== undefined)
}

function paintsAsActive(
  item: NavItem,
  items: readonly NavItem[],
  location: { pathname: string; search: Record<string, unknown> },
): boolean {
  if (isFilteredEntry(item) || location.pathname !== item.to) {
    return false
  }

  const aFilteredSiblingMatches = items.some(
    (other) =>
      other.key !== item.key &&
      other.to === item.to &&
      isFilteredEntry(other) &&
      Object.entries(other.search ?? {}).every(([key, value]) => location.search[key] === value),
  )

  return !aFilteredSiblingMatches
}

export interface InternalSidebarProps {
  /** Already filtered by permission in the shell, which also decides whether to render this at all. */
  items: readonly NavItem[]
  userName: string
  userEmail: string
  onLogout: () => void
  /** Desktop icon-rail (lg+). Ignored on mobile, where the sidebar is a drawer. */
  collapsed: boolean
  /** Mobile drawer open/closed (< lg). */
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function InternalSidebar({
  items,
  userName,
  userEmail,
  onLogout,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: InternalSidebarProps) {
  const { authSession } = rootRoute.useRouteContext()
  const location = useLocation({
    select: (loc) => ({ pathname: loc.pathname, search: loc.search as Record<string, unknown> }),
  })
  const userRoles = authSession?.user?.roles ?? []
  const roleLabel = userRoles.map((role) => ROLE_LABELS[role]).find((label) => label !== undefined)

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label={m.nav_menu_close()}
          onClick={onCloseMobile}
          className="fixed inset-x-0 bottom-0 top-[var(--mri-topbar-h)] z-30 bg-black/50 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-[var(--mri-topbar-h)] z-40 flex w-[236px] flex-none flex-col border-r border-mri-border bg-mri-surface transition-transform duration-200',
          'lg:sticky lg:z-20 lg:h-[calc(100vh-var(--mri-topbar-h))] lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[72px]' : 'lg:w-[236px]',
        )}
      >
        <nav
          aria-label="Main navigation"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
        >
          {items.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              search={item.search ?? {}}
              title={item.label()}
              onClick={onCloseMobile}
              className={cn(
                'flex items-center gap-[13px] rounded-[9px] border px-[13px] py-[11px] transition-colors duration-150',
                collapsed && 'lg:justify-center lg:px-0',
              )}
              activeProps={{ className: SIDEBAR_LINK_ACTIVE_CLASSES }}
              inactiveProps={{
                className: paintsAsActive(item, items, location)
                  ? SIDEBAR_LINK_ACTIVE_CLASSES
                  : SIDEBAR_LINK_INACTIVE_CLASSES,
              }}
              activeOptions={{ exact: item.to === '/', explicitUndefined: true }}
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'size-[18px] flex-none',
                      isActive ? 'text-mri-redh' : 'text-mri-text2',
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      isActive ? 'font-bold text-mri-text' : 'font-semibold text-mri-text2',
                      collapsed && 'lg:hidden',
                    )}
                  >
                    {item.label()}
                  </span>
                </>
              )}
            </Link>
          ))}
        </nav>

        <div className="border-t border-mri-border px-[18px] py-4">
          <div
            className={cn('mb-3 flex items-center gap-[11px]', collapsed && 'lg:justify-center')}
          >
            <span
              aria-hidden="true"
              className="grid size-9 flex-none place-items-center rounded-full bg-mri-red text-[12.5px] font-bold text-white"
            >
              {getInitials(userName, userEmail)}
            </span>
            <div className={cn('min-w-0 leading-tight', collapsed && 'lg:hidden')}>
              <div className="truncate text-[13.5px] font-bold text-mri-text">{userName}</div>
              <div className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-mri-text2">
                {roleLabel !== undefined ? roleLabel() : userEmail}
              </div>
            </div>
          </div>
          <div className={cn('flex flex-col gap-1.5', collapsed && 'lg:items-center')}>
            <Link
              to="/settings/security"
              title={m.nav_security()}
              className="flex items-center gap-2 text-[12.5px] font-semibold text-mri-text2 transition-colors hover:text-mri-redh"
            >
              <Shield className="size-4 flex-none" aria-hidden="true" />
              <span className={cn(collapsed && 'lg:hidden')}>{m.nav_security()}</span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              title={m.auth_logout()}
              className="flex cursor-pointer items-center gap-2 text-left text-[12.5px] font-semibold text-mri-text2 transition-colors hover:text-mri-redh"
            >
              <LogOut className="size-4 flex-none" aria-hidden="true" />
              <span className={cn(collapsed && 'lg:hidden')}>{m.auth_logout()} →</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
