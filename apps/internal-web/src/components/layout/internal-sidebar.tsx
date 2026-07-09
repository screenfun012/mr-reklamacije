import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { getRouteApi, Link } from '@tanstack/react-router'

import { internalNavItems } from '~/config/navigation'

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
}

export function InternalSidebar({ userName, userEmail, onLogout }: InternalSidebarProps) {
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
    <aside className="sticky top-[58px] z-20 flex h-[calc(100vh-58px)] w-[236px] flex-none flex-col border-r border-mri-border bg-mri-surface">
      <nav
        aria-label="Main navigation"
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
      >
        {visibleItems.map((item, index) => (
          <Link
            key={item.key}
            to={item.to}
            className="flex items-center gap-[13px] rounded-[9px] border px-[13px] py-[11px] transition-colors duration-150"
            activeProps={{ className: 'border-[rgba(237,28,36,.35)] bg-[rgba(237,28,36,.1)]' }}
            inactiveProps={{ className: 'border-transparent hover:bg-mri-rowhv' }}
            activeOptions={{ exact: item.to === '/' }}
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'font-mono text-[10px] font-semibold tracking-[0.06em]',
                    isActive ? 'text-mri-redh' : 'text-mri-text2',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    isActive ? 'font-bold text-mri-text' : 'font-semibold text-mri-text2',
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
        <div className="mb-3 flex items-center gap-[11px]">
          <span
            aria-hidden="true"
            className="grid size-9 flex-none place-items-center rounded-full bg-mri-red text-[12.5px] font-bold text-white"
          >
            {getInitials(userName, userEmail)}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13.5px] font-bold text-mri-text">{userName}</div>
            <div className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-mri-text2">
              {roleLabel !== undefined ? roleLabel() : userEmail}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Link
            to="/settings/security"
            className="text-[12.5px] font-semibold text-mri-text2 transition-colors hover:text-mri-redh"
          >
            {m.nav_security()}
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="cursor-pointer text-left text-[12.5px] font-semibold text-mri-text2 transition-colors hover:text-mri-redh"
          >
            {m.auth_logout()} →
          </button>
        </div>
      </div>
    </aside>
  )
}
