import { m } from '@mr/i18n'
import { getInitials } from '@mr/shared'
import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import { LogOut, Shield } from 'lucide-react'
import type { ReactElement } from 'react'

import { adminNavItems } from '~/config/navigation'

export interface AdminSidebarProps {
  /** Desktop icon-rail (lg+). Ignored on mobile, where the sidebar is a drawer. */
  collapsed: boolean
  /** Mobile drawer open/closed (< lg). */
  mobileOpen: boolean
  onCloseMobile: () => void
  userName: string
  userEmail: string
  onLogout: () => void
}

export function AdminSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  userName,
  userEmail,
  onLogout,
}: AdminSidebarProps): ReactElement {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label={m.nav_menu_close()}
          onClick={onCloseMobile}
          className="fixed inset-x-0 bottom-0 top-[60px] z-30 bg-black/50 lg:hidden"
        />
      ) : null}

      <aside
        aria-label="Sidebar navigation"
        className={cn(
          'fixed bottom-0 left-0 top-[60px] z-40 flex w-60 flex-none flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200',
          'lg:sticky lg:z-20 lg:h-[calc(100vh-60px)] lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[72px]' : 'lg:w-60',
        )}
      >
        <nav
          aria-label="Main navigation"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
        >
          {adminNavItems.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              title={item.label()}
              onClick={onCloseMobile}
              className={cn(
                'flex items-center gap-[13px] rounded-[9px] border px-[13px] py-[11px] transition-colors duration-150',
                collapsed && 'lg:justify-center lg:px-0',
              )}
              // A tinted panel, not the solid red block this used to be: `bg-sidebar-primary` is
              // the full brand red, which read as a warning bar down the side of every screen and
              // was the loudest thing the admin panel did. Same red at a tenth, as internal-web
              // does it — but through the token with an opacity modifier, where internal hardcodes
              // `rgba(237,28,36,.1)`. A literal there is a second definition of the brand red that
              // no token change would ever reach.
              activeProps={{ className: 'border-mr-brand/35 bg-mr-brand/10' }}
              inactiveProps={{ className: 'border-transparent hover:bg-accent' }}
              // Without `exact`, the dashboard link (to='/') would match on every child route; all
              // other items match as prefix.
              activeOptions={{ exact: item.to === '/' }}
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'size-[18px] flex-none',
                      isActive ? 'text-mr-brand-400' : 'text-muted-foreground',
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      'truncate text-sm',
                      isActive
                        ? 'font-bold text-foreground'
                        : 'font-semibold text-muted-foreground',
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

        <div className="flex-none border-t border-border px-[18px] py-4">
          <div
            className={cn('mb-3 flex items-center gap-[11px]', collapsed && 'lg:justify-center')}
          >
            <span
              aria-hidden="true"
              className="grid size-9 flex-none place-items-center rounded-full bg-mr-brand text-[12.5px] font-bold text-white"
            >
              {getInitials(userName, userEmail)}
            </span>
            <div className={cn('min-w-0 leading-tight', collapsed && 'lg:hidden')}>
              <div className="truncate text-[13.5px] font-bold text-foreground">{userName}</div>
              <div className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                {userEmail}
              </div>
            </div>
          </div>
          <div className={cn('flex flex-col gap-1.5', collapsed && 'lg:items-center')}>
            <Link
              to="/settings/security"
              title={m.nav_security()}
              onClick={onCloseMobile}
              className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-mr-brand-400"
            >
              <Shield className="size-4 flex-none" aria-hidden="true" />
              <span className={cn(collapsed && 'lg:hidden')}>{m.nav_security()}</span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              title={m.auth_logout()}
              className="flex cursor-pointer items-center gap-2 text-left text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-mr-brand-400"
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
