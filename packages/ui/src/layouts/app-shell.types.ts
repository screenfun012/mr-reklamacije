import type { ReactNode } from 'react'

export interface AppShellProps {
  /**
   * Sidebar slot. App-specific navigation, branding, user actions.
   * Rendered inside semantic <aside> at fixed 240px width on desktop.
   */
  sidebar: ReactNode
  /**
   * Top bar slot. App-specific user info, notifications, breadcrumbs.
   * Rendered inside semantic <header> at fixed 60px height.
   */
  topbar: ReactNode
  /**
   * Main content area. Typically TanStack Router <Outlet /> or
   * a route component.
   */
  children: ReactNode
  /**
   * Optional className passthrough for the root grid container.
   */
  className?: string
}
