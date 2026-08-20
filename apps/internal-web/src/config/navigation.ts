import {
  CLAIMS_LIST_VIEW_PERMISSIONS,
  INTAKE_ORDERS_VIEW_PERMISSIONS,
  MACHINING_CLAIM_CATEGORY_CODE,
  STATISTICS_VIEW_PERMISSIONS,
} from '@mr/shared'
import { BarChart3, Briefcase, Car, Cog, Inbox, LayoutDashboard } from 'lucide-react'
import type { ComponentType } from 'react'

import { m } from '@mr/i18n'

export interface NavItem {
  key: string
  label: () => string
  to: string
  /** Search params the entry opens its screen with — a filtered view of an existing list. */
  search?: Record<string, string>
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
    permissions: [...CLAIMS_LIST_VIEW_PERMISSIONS],
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
    // Not a screen of its own: machining is a category a claim carries, so this is the
    // claims list with that filter applied. It keeps its place in the menu because that
    // is where people look for the work — but there is nothing behind it to maintain,
    // and a renamed or retired category needs no change here beyond the code.
    key: 'masinska-obrada',
    label: m.nav_masinska_obrada,
    to: '/reklamacije',
    search: { categoryCode: MACHINING_CLAIM_CATEGORY_CODE },
    icon: Cog,
    permissions: [...CLAIMS_LIST_VIEW_PERMISSIONS],
  },
  {
    key: 'servis',
    label: m.nav_servis,
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
