import { usePermissions } from '@mr/auth/route-guards'
import { MrEnginesLogo } from '@mr/ui'
import { Link } from '@tanstack/react-router'

import { internalNavItems } from '~/config/navigation'
import { authClient } from '~/lib/auth-client'

export function InternalSidebar() {
  const { has } = usePermissions(authClient)
  const visibleItems = internalNavItems.filter(
    (item) => item.permission === undefined || has(item.permission),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-sidebar-border">
        <MrEnginesLogo />
      </div>

      <nav className="flex-1 p-2" aria-label="Main navigation">
        <ul className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  activeProps={{
                    className:
                      'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary',
                  }}
                  activeOptions={{ exact: item.to === '/' }}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label()}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
