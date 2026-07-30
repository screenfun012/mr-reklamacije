import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { getRouteApi, Link } from '@tanstack/react-router'
import { LogOut, Shield } from 'lucide-react'

import type { NavItem } from '~/config/navigation'
import { getInitials } from './internal-user-chip'

const rootRoute = getRouteApi('__root__')

const ROLE_LABELS: Record<string, () => string> = {
  admin: m.users_role_admin,
  operator: m.users_role_operator,
  viewer: m.users_role_viewer,
  client: m.users_role_client,
  serviser: m.users_role_serviser,
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
              title={item.label()}
              onClick={onCloseMobile}
              className={cn(
                'flex items-center gap-[13px] rounded-[9px] border px-[13px] py-[11px] transition-colors duration-150',
                collapsed && 'lg:justify-center lg:px-0',
              )}
              activeProps={{ className: 'border-[rgba(237,28,36,.35)] bg-[rgba(237,28,36,.1)]' }}
              inactiveProps={{ className: 'border-transparent hover:bg-mri-rowhv' }}
              activeOptions={{ exact: item.to === '/' }}
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
