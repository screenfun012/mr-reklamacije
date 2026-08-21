import {
  INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS,
  INTAKE_ORDERS_VIEW_PERMISSIONS,
  STATISTICS_VIEW_PERMISSIONS,
} from '@mr/shared'
import { BarChart3, Briefcase, Car, Inbox, LayoutDashboard } from 'lucide-react'
import type { ComponentType } from 'react'

import { m } from '@mr/i18n'

export interface NavItem {
  key: string
  label: () => string
  to: string
  /**
   * The entry is a group whose children are read from a query, not written here — today only
   * the claim categories. The sidebar renders the children; the palette lists the group alone.
   */
  children?: 'claim-categories'
  icon: ComponentType<{ className?: string }>
  /** When set, nav link is hidden unless the user has this permission. */
  permission?: string
  /** When set, nav link is shown if the user has any of these permissions. */
  permissions?: readonly string[]
}

export const internalNavItems: NavItem[] = [
  {
    // The dashboard is claim-shaped, so it is gated like the claims list rather than
    // left open: a serviser holds no claims permission and would otherwise land on a
    // screen with nothing on it (docs/25 §3.1).
    key: 'pocetna',
    label: m.nav_pocetna,
    to: '/',
    icon: LayoutDashboard,
    permissions: [...INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS],
  },
  {
    key: 'pristiglo',
    label: m.nav_pristiglo,
    to: '/pristiglo',
    icon: Inbox,
    permission: 'client_submissions.manage',
  },
  {
    // A group: its children are the kinds of work the catalogue knows, read at render time.
    // Adding one is a row in the admin panel, never a line here.
    key: 'reklamacije',
    label: m.nav_reklamacije,
    to: '/reklamacije',
    children: 'claim-categories',
    icon: Briefcase,
    permissions: [...INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS],
  },
  {
    key: 'servis',
    label: m.nav_prijem_vozila,
    to: '/prijem',
    icon: Car,
    permissions: [...INTAKE_ORDERS_VIEW_PERMISSIONS],
  },
  {
    key: 'statistika',
    label: m.nav_statistika,
    to: '/statistika',
    icon: BarChart3,
    permissions: [...STATISTICS_VIEW_PERMISSIONS],
  },
]

function hasAnyPermission(
  userPermissions: readonly string[],
  required: readonly string[],
): boolean {
  const permissionSet = new Set(userPermissions)
  return required.some((permission) => permissionSet.has(permission))
}

/**
 * Filters nav items to those the user's permissions allow (ungated items always
 * show). Generic over the item shape so the sidebar, the palette's navigation
 * list and its action list all gate through this one function.
 */
export function filterVisibleNavItems<
  T extends { permission?: string; permissions?: readonly string[] },
>(items: readonly T[], userPermissions: readonly string[]): T[] {
  return items.filter((item) => {
    if (item.permissions !== undefined) {
      return hasAnyPermission(userPermissions, item.permissions)
    }
    if (item.permission !== undefined) {
      return userPermissions.includes(item.permission)
    }
    return true
  })
}
