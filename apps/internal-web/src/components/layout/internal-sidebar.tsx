import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { getRouteApi, Link } from '@tanstack/react-router'
import { LogOut, Shield } from 'lucide-react'

import { internalNavItems } from '~/config/navigation'
import { InboxNavBadge } from '~/features/inbox/inbox-nav-badge'

const rootRoute = getRouteApi('__root__')

const ROLE_LABELS: Record<string, () => string> = {
  admin: m.users_role_admin,
  operator: m.users_role_operator,
  viewer: m.users_role_viewer,
  client: m.users_role_client,
}

function hasAnyPermission(
  userPermissions: readonly string[],
  required: readonly string[],
): boolean {
  const permissionSet = new Set(userPermissions)
  return required.some((permission) => permissionSet.has(permission))
}

function getInitials(name: string, email: string): string {
  const source = (name.trim().length > 0 ? name : email).trim()
  if (source.length === 0) {
    return '?'
  }
  const parts = source.split(/\s+/).filter((part) => part.length > 0)
  const initials =
    parts.length >= 2 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : source.slice(0, 2)
  return initials.toUpperCase()
}

export interface InternalSidebarProps {
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
  userName,
  userEmail,
  onLogout,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: InternalSidebarProps) {
  const { authSession } = rootRoute.useRouteContext()
  const userPermissions = authSession?.user?.permissions ?? []
  const userRoles = authSession?.user?.roles ?? []
  const roleLabel = userRoles.map((role) => ROLE_LABELS[role]).find((label) => label !== undefined)

  const visibleItems = internalNavItems.filter((item) => {
    if (item.permissions !== undefined) {
      return hasAnyPermission(userPermissions, item.permissions)
    }
    if (item.permission !== undefined) {
      return userPermissions.includes(item.permission)
    }
    return true
  })

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label={m.nav_menu_close()}
          onClick={onCloseMobile}
          className="fixed inset-x-0 bottom-0 top-[58px] z-30 bg-black/50 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-[58px] z-40 flex w-[236px] flex-none flex-col border-r border-mri-border bg-mri-surface transition-transform duration-200',
          'lg:sticky lg:z-20 lg:h-[calc(100vh-58px)] lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[72px]' : 'lg:w-[236px]',
        )}
      >
        <nav
          aria-label="Main navigation"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
        >
          {visibleItems.map((item) => (
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
                  {item.key === 'pristiglo' ? (
                    <InboxNavBadge className={cn(collapsed && 'lg:hidden')} />
                  ) : null}
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
