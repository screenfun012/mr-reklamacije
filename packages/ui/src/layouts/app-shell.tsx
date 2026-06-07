import { cn } from '../lib/cn.js'

import type { AppShellProps } from './app-shell.types.js'

/**
 * Slot-based application shell layout.
 *
 * Provides a desktop-first grid structure with fixed sidebar (left)
 * and topbar (top), and a scrollable main content area filling the
 * remaining space. App-specific content for sidebar and topbar is
 * supplied as ReactNode slots — this layout is intentionally
 * unaware of routing, navigation config, or user state.
 *
 * Mobile responsiveness is deferred to a future iteration that
 * adds a collapsible sidebar drawer.
 */
export function AppShell({ sidebar, topbar, children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        'min-h-screen grid grid-cols-[240px_1fr] grid-rows-[60px_1fr]',
        'bg-background text-foreground',
        className,
      )}
    >
      <aside
        aria-label="Sidebar navigation"
        className="row-span-2 border-r border-border overflow-y-auto bg-sidebar text-sidebar-foreground"
      >
        {sidebar}
      </aside>
      <header className="border-b border-border flex items-center justify-end px-6">
        {topbar}
      </header>
      <main className="overflow-y-auto p-6">{children}</main>
    </div>
  )
}
