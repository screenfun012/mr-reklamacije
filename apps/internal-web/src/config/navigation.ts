import { CLAIMS_LIST_VIEW_PERMISSIONS } from '@mr/shared'
import { BarChart3, Briefcase, Inbox, LayoutDashboard } from 'lucide-react'
import type { ComponentType } from 'react'

import { m } from '@mr/i18n'

export interface NavItem {
  key: string
  label: () => string
  to: string
  icon: ComponentType<{ className?: string }>
  /** When set, nav link is hidden unless the user has this permission. */
  permission?: string
  /** When set, nav link is shown if the user has any of these permissions. */
  permissions?: readonly string[]
}

export const internalNavItems: NavItem[] = [
  {
    key: 'pocetna',
    label: m.nav_pocetna,
    to: '/',
    icon: LayoutDashboard,
  },
  {
    key: 'pristiglo',
    label: m.nav_pristiglo,
    to: '/pristiglo',
    icon: Inbox,
    permission: 'client_submissions.manage',
  },
  {
    key: 'reklamacije',
    label: m.nav_reklamacije,
    to: '/reklamacije',
    icon: Briefcase,
    permissions: [...CLAIMS_LIST_VIEW_PERMISSIONS],
  },
  {
    key: 'statistika',
    label: m.nav_statistika,
    to: '/statistika',
    icon: BarChart3,
  },
]
