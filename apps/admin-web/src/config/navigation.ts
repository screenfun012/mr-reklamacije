import { m } from '@mr/i18n'
import {
  Briefcase,
  Building2,
  Cog,
  Cpu,
  Globe,
  Handshake,
  HardHat,
  Inbox,
  LayoutDashboard,
  Network,
  ScrollText,
  Users,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface NavItem {
  /** Stable React key */
  key: string
  /**
   * i18n message function reference — called at render time to
   * pick up the currently active locale. Must NOT be invoked here
   * (that would freeze the label at module evaluation, defeating
   * locale switching).
   */
  label: () => string
  /** TanStack Router target path */
  to: string
  /** Lucide icon component */
  icon: ComponentType<{ className?: string }>
}

/**
 * Admin navigation items. Order in the array determines display
 * order in the sidebar. Keys are stable across locale changes.
 */
export const adminNavItems: NavItem[] = [
  {
    key: 'dashboard',
    label: m.nav_dashboard,
    to: '/',
    icon: LayoutDashboard,
  },
  {
    key: 'emotive-claims',
    label: m.nav_emotive_claims,
    to: '/emotive-claims',
    icon: Globe,
  },
  {
    key: 'domace-claims',
    label: m.nav_domace_claims,
    to: '/domace-claims',
    icon: Briefcase,
  },
  {
    key: 'users',
    label: m.nav_users,
    to: '/users',
    icon: Users,
  },
  {
    key: 'audit',
    label: m.nav_audit,
    to: '/audit',
    icon: ScrollText,
  },
  {
    key: 'engine-manufacturers',
    label: m.nav_engine_manufacturers,
    to: '/settings/engine-manufacturers',
    icon: Cog,
  },
  {
    key: 'engine-types',
    label: m.nav_engine_types,
    to: '/settings/engine-types',
    icon: Cpu,
  },
  {
    key: 'customers',
    label: m.nav_customers,
    to: '/settings/customers',
    icon: Building2,
  },
  {
    key: 'departments',
    label: m.nav_departments,
    to: '/settings/departments',
    icon: Network,
  },
  {
    key: 'employees',
    label: m.nav_employees,
    to: '/settings/employees',
    icon: HardHat,
  },
  {
    key: 'external-parties',
    label: m.nav_external_parties,
    to: '/settings/external-parties',
    icon: Handshake,
  },
  {
    key: 'claim-sources',
    label: m.nav_claim_sources,
    to: '/settings/claim-sources',
    icon: Inbox,
  },
]
