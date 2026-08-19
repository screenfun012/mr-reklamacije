import { m } from '@mr/i18n'
import { getInitials } from '@mr/shared'
import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import { LogOut, Shield } from 'lucide-react'
import type { ReactElement } from 'react'

import { adminNavGroups, type NavItem } from '~/config/navigation'

export interface AdminSidebarProps {
  /** Desktop icon-rail (lg+). Ignored on mobile, where the sidebar is a drawer. */
  collapsed: boolean
  /** Mobile drawer open/closed (< lg). */
  mobileOpen: boolean
  onCloseMobile: () => void
  userName: string
  userEmail: string
  onLogout: () => void
  /**
   * Accounts waiting for a decision — drawn on "Korisnici" as an amber count. It is the one number
   * in this app that means "somebody is blocked until you look", so it belongs where the eye lands
   * first rather than only on the dashboard.
   */
  pendingUserCount: number
}

function NavRow({
  item,
  collapsed,
  onCloseMobile,
  badge,
  compact,
}: {
  item: NavItem
  collapsed: boolean
  onCloseMobile: () => void
  badge?: number
  /** The catalogue group sits a notch smaller than the rest — ten rows in a row need the air. */
  compact: boolean
}): ReactElement {
  return (
    <Link
      to={item.to}
      title={item.label()}
      onClick={onCloseMobile}
      className={cn(
        'flex items-center gap-[11px] rounded-[9px] px-3 transition-colors duration-150',
        compact ? 'h-[38px]' : 'h-10',
        collapsed && 'lg:justify-center lg:px-0',
      )}
      // A tinted panel, not the solid red block this used to be — the same red at a ninth, which is
      // the prototype's `rgba(237,28,36,.11)` expressed through the token so a brand change reaches
      // it. No border: the tint alone marks the row there, and the outline read as a second state.
      activeProps={{ className: 'bg-mr-brand/[0.11]' }}
      inactiveProps={{ className: 'hover:bg-mr-list-item-hover' }}
      // Without `exact`, the dashboard link (to='/') would match on every child route; all
      // other items match as prefix.
      activeOptions={{ exact: item.to === '/' }}
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              'flex-none',
              compact ? 'size-[15px] opacity-80' : 'size-4 opacity-85',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              'flex-1 truncate',
              compact ? 'text-[13px]' : 'text-[13.5px]',
              isActive ? 'font-extrabold text-foreground' : 'font-semibold text-muted-foreground',
              collapsed && 'lg:hidden',
            )}
          >
            {item.label()}
          </span>
          {badge !== undefined && badge > 0 ? (
            <span
              className={cn(
                'flex-none rounded-full bg-adm-amb/15 px-[7px] py-0.5 font-mono text-[10px] font-bold text-adm-amb',
                collapsed && 'lg:hidden',
              )}
            >
              {badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  )
}

export function AdminSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  userName,
  userEmail,
  onLogout,
  pendingUserCount,
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
          'fixed bottom-0 left-0 top-[60px] z-40 flex w-[236px] flex-none flex-col overflow-y-auto border-r border-border bg-card text-foreground transition-transform duration-200',
          'lg:sticky lg:z-20 lg:h-[calc(100vh-60px)] lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[72px]' : 'lg:w-[236px]',
        )}
      >
        <nav
          aria-label="Main navigation"
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-3 pt-3.5"
        >
          {adminNavGroups.map((group) => (
            <div key={group.key} className="contents">
              {group.label === undefined ? null : (
                <div
                  className={cn(
                    'mb-1.5 mt-3.5 px-3 font-mono text-[8.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground',
                    // In the icon rail there is no room for a word; the gap that stays is enough
                    // to keep the three groups apart.
                    collapsed && 'lg:invisible lg:h-2 lg:overflow-hidden',
                  )}
                >
                  {group.label()}
                </div>
              )}
              {group.items.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  collapsed={collapsed}
                  compact={group.key === 'catalogs'}
                  onCloseMobile={onCloseMobile}
                  {...(item.key === 'users' ? { badge: pendingUserCount } : {})}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex-none border-t border-border px-[18px] py-3">
          <div className={cn('mb-2.5 flex items-center gap-2.5', collapsed && 'lg:justify-center')}>
            <span
              aria-hidden="true"
              className="grid size-8 flex-none place-items-center rounded-full bg-mr-brand font-mono text-[11px] font-bold text-white"
            >
              {getInitials(userName, userEmail)}
            </span>
            <div className={cn('min-w-0 leading-tight', collapsed && 'lg:hidden')}>
              <div className="truncate text-[13px] font-bold text-foreground">{userName}</div>
              <div className="truncate font-mono text-[10px] font-medium text-muted-foreground">
                {userEmail}
              </div>
            </div>
          </div>
          <div className={cn('flex gap-2', collapsed && 'lg:flex-col lg:items-center')}>
            <Link
              to="/settings/security"
              title={m.nav_security()}
              onClick={onCloseMobile}
              className={cn(
                'flex h-[34px] flex-1 items-center justify-center rounded-lg border border-mr-border-strong bg-adm-inbg text-[11.5px] font-bold text-muted-foreground transition-colors hover:text-foreground',
                collapsed && 'lg:size-9 lg:flex-none',
              )}
            >
              {/* Word when there is room, icon when there is not — the rail is 72px wide. */}
              <Shield
                className={cn('hidden size-4 flex-none', collapsed && 'lg:block')}
                aria-hidden="true"
              />
              <span className={cn(collapsed && 'lg:hidden')}>{m.nav_security()}</span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              title={m.auth_logout()}
              className={cn(
                'flex h-[34px] flex-1 cursor-pointer items-center justify-center rounded-lg text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-adm-red-h',
                collapsed && 'lg:size-9 lg:flex-none',
              )}
            >
              <LogOut
                className={cn('hidden size-4 flex-none', collapsed && 'lg:block')}
                aria-hidden="true"
              />
              <span className={cn(collapsed && 'lg:hidden')}>{m.auth_logout()} →</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
