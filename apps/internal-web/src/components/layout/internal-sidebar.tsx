import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { getRouteApi, Link } from '@tanstack/react-router'
import { LogOut, Shield } from 'lucide-react'

import type { NavItem } from '~/config/navigation'
import { getInitials } from '@mr/shared'

import { ChatUnreadBadge } from '~/features/chat/chat-unread-badge'

import { ClaimsNavGroup } from './claims-nav-group'

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

/** `01`–`05`, in the order the menu is rendered. */
function navIndex(items: readonly NavItem[], key: string): string {
  return String(items.findIndex((item) => item.key === key) + 1).padStart(2, '0')
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
  /** Whether the claims group was left open — from the request, so the server folds it too. */
  claimsNavOpen: boolean
  onCloseMobile: () => void
}

export function InternalSidebar({
  items,
  userName,
  userEmail,
  onLogout,
  collapsed,
  mobileOpen,
  claimsNavOpen,
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
          collapsed ? 'lg:w-[60px]' : 'lg:w-[236px]',
        )}
      >
        <nav
          aria-label="Main navigation"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 pb-3 pt-4"
        >
          {items.map((item) =>
            item.children === 'claim-categories' ? (
              <ClaimsNavGroup
                key={item.key}
                item={item}
                index={navIndex(items, item.key)}
                // The rail is a DESKTOP shape. Every plain entry says so in CSS
                // (`collapsed && 'lg:hidden'`); this group branches in JS, which has no
                // breakpoint — so a sidebar collapsed once on the desktop turned entry 03 into a
                // bare 38px icon inside the phone drawer, its categories reachable only through a
                // popover over the page. Reproduced at 395px, 2026-08-22.
                collapsed={collapsed && !mobileOpen}
                defaultOpen={claimsNavOpen}
                onNavigate={onCloseMobile}
              />
            ) : (
              <Link
                key={item.key}
                to={item.to}
                title={item.label()}
                onClick={onCloseMobile}
                className={cn(
                  'flex h-[38px] items-center gap-[10px] rounded-[9px] border px-[11px] transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.99]',
                  collapsed && 'lg:justify-center lg:px-0',
                )}
                activeProps={{ className: SIDEBAR_LINK_ACTIVE_CLASSES }}
                inactiveProps={{ className: SIDEBAR_LINK_INACTIVE_CLASSES }}
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
                    {/* The prototype numbers the menu 01–05 in mono — it is how the eye finds a
                        row again after looking away, and it is the same hand as every other
                        technical label in this app. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'font-mono text-[10px] font-medium opacity-60',
                        collapsed && 'lg:hidden',
                      )}
                    >
                      {navIndex(items, item.key)}
                    </span>
                    <span
                      className={cn(
                        'text-[13.5px]',
                        isActive ? 'font-bold text-mri-text' : 'font-semibold text-mri-text2',
                        collapsed && 'lg:hidden',
                      )}
                    >
                      {item.label()}
                    </span>
                    {item.badge === 'chat-unread' ? (
                      <ChatUnreadBadge className={cn(collapsed && 'lg:hidden')} />
                    ) : null}
                  </>
                )}
              </Link>
            ),
          )}
        </nav>

        <div className="border-t border-mri-border px-2.5 pb-0.5 pt-3">
          <div className={cn('mb-3 flex items-center gap-[9px]', collapsed && 'lg:justify-center')}>
            <span
              aria-hidden="true"
              className="grid size-[30px] flex-none place-items-center rounded-full bg-mri-red text-[11px] font-extrabold text-white"
            >
              {getInitials(userName, userEmail)}
            </span>
            <div className={cn('min-w-0 leading-tight', collapsed && 'lg:hidden')}>
              <div className="truncate text-[12.5px] font-bold text-mri-text">{userName}</div>
              <div className="truncate text-[10.5px] text-mri-text2">
                {roleLabel !== undefined ? roleLabel() : userEmail}
              </div>
            </div>
          </div>
          <div className={cn('flex flex-col gap-1.5', collapsed && 'lg:items-center')}>
            <Link
              to="/settings/security"
              title={m.nav_security()}
              className="flex min-h-9 items-center gap-2 text-[12.5px] font-semibold text-mri-text2 transition-colors hover:text-mri-redh"
            >
              <Shield className="size-4 flex-none" aria-hidden="true" />
              <span className={cn(collapsed && 'lg:hidden')}>{m.nav_security()}</span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              title={m.auth_logout()}
              className="flex min-h-9 cursor-pointer items-center gap-2 text-left text-[12.5px] font-semibold text-mri-text2 transition-colors hover:text-mri-redh"
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
