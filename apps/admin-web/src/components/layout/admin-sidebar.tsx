import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'

import { adminNavItems } from '~/config/navigation'

export interface AdminSidebarProps {
  /** Desktop icon-rail (lg+). Ignored on mobile, where the sidebar is a drawer. */
  collapsed: boolean
  /** Mobile drawer open/closed (< lg). */
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function AdminSidebar({ collapsed, mobileOpen, onCloseMobile }: AdminSidebarProps) {
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
        <nav className="flex-1 p-2" aria-label="Main navigation">
          <ul className="flex flex-col gap-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    title={item.label()}
                    onClick={onCloseMobile}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      collapsed && 'lg:justify-center lg:px-0',
                    )}
                    activeProps={{
                      // Only the "active additions" — TanStack Router concatenates
                      // `className` and `activeProps.className` so the base classes
                      // above stay active.
                      className:
                        'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary',
                    }}
                    // Without `exact`, the dashboard link (to='/') would match on
                    // every child route; all other items match as prefix.
                    activeOptions={{ exact: item.to === '/' }}
                  >
                    <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
                    <span className={cn(collapsed && 'lg:hidden')}>{item.label()}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
