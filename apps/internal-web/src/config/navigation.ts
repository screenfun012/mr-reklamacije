import { BarChart3, Briefcase, Inbox, LayoutDashboard } from 'lucide-react'
import type { ComponentType } from 'react'

import { m } from '@mr/i18n'

export interface NavItem {
  key: string
  label: () => string
  to: string
  icon: ComponentType<{ className?: string }>
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
  },
  {
    key: 'reklamacije',
    label: m.nav_reklamacije,
    to: '/reklamacije',
    icon: Briefcase,
  },
  {
    key: 'statistika',
    label: m.nav_statistika,
    to: '/statistika',
    icon: BarChart3,
  },
]
