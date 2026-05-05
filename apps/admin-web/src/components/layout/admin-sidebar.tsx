import { Link } from '@tanstack/react-router';

import { adminNavItems } from '~/config/navigation';

export function AdminSidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-sidebar-border">
        <h1 className="text-lg font-semibold">MR Reklamacije</h1>
        <p className="text-xs text-muted-foreground">Admin</p>
      </div>

      <nav className="flex-1 p-2" aria-label="Main navigation">
        <ul className="flex flex-col gap-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  activeProps={{
                    // Only the "active additions" — TanStack Router
                    // concatenates `className` and `activeProps.className`
                    // so the base hover/layout classes above stay active.
                    className:
                      'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary',
                  }}
                  // Without `exact`, the dashboard link (to='/') would
                  // match on every child route because every path starts
                  // with '/'. All other items match as prefix so nested
                  // routes can still highlight their parent.
                  activeOptions={{ exact: item.to === '/' }}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label()}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
