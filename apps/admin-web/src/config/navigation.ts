import { m } from '@mr/i18n'
import {
  Building2,
  ClipboardCheck,
  Cog,
  Cpu,
  Handshake,
  HardHat,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ListTree,
  Network,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TriangleAlert,
  Truck,
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
  /**
   * The screen exists in the menu but the catalogue behind it does not yet — it opens a page that
   * says so. Two entries carry it (`admin-prototip.dc.html` draws them; Nikola, 19.08.2026).
   */
  comingSoon?: true
}

export interface NavGroup {
  key: string
  /** Absent on the first group — the dashboard needs no heading above it. */
  label?: () => string
  items: NavItem[]
}

/**
 * Admin navigation, in three named groups plus the dashboard.
 *
 * The flat list of thirteen entries this replaces put "Korisnici" and "Tipovi motora" on the same
 * footing, which is most of why the menu read as a bucket: a person and an engine size are not the
 * same kind of thing. Groups are the prototype's (`admin-prototip.dc.html`).
 */
export const adminNavGroups: NavGroup[] = [
  {
    key: 'top',
    items: [
      {
        key: 'dashboard',
        label: m.nav_dashboard,
        to: '/',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    key: 'people',
    label: m.nav_group_people,
    items: [
      {
        key: 'users',
        label: m.nav_users,
        to: '/users',
        icon: Users,
      },
      {
        key: 'roles',
        label: m.nav_roles,
        to: '/settings/roles',
        icon: ShieldCheck,
      },
      {
        key: 'audit',
        label: m.nav_audit,
        to: '/audit',
        icon: ScrollText,
      },
    ],
  },
  {
    key: 'catalogs',
    label: m.nav_group_catalogs,
    items: [
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
        key: 'claim-categories',
        label: m.nav_claim_categories,
        to: '/settings/claim-categories',
        icon: Tags,
      },
      {
        key: 'claim-category-fields',
        label: m.nav_claim_category_fields,
        to: '/settings/claim-category-fields',
        icon: ListChecks,
      },
      {
        key: 'claim-category-field-options',
        label: m.nav_claim_category_field_options,
        to: '/settings/claim-category-field-options',
        icon: ListTree,
      },
      {
        key: 'claim-sources',
        label: m.nav_claim_sources,
        to: '/settings/claim-sources',
        icon: Inbox,
      },
      {
        key: 'intake-checklist',
        label: m.nav_intake_checklist,
        to: '/settings/intake-checklist',
        icon: ClipboardCheck,
      },
      {
        key: 'intake-damage-types',
        label: m.nav_intake_damage_types,
        to: '/settings/intake-damage-types',
        icon: TriangleAlert,
        comingSoon: true,
      },
      {
        key: 'intake-arrival-modes',
        label: m.nav_intake_arrival_modes,
        to: '/settings/intake-arrival-modes',
        icon: Truck,
        comingSoon: true,
      },
    ],
  },
  {
    key: 'system',
    label: m.nav_group_system,
    items: [
      {
        key: 'app-settings',
        label: m.nav_app_settings,
        to: '/settings/app',
        icon: SlidersHorizontal,
      },
    ],
  },
]

/**
 * Every entry, flat. The top bar reads the section name off it (longest matching path wins), so a
 * screen reachable from the menu can never be added without its name reaching the bar.
 */
export const adminNavItems: NavItem[] = adminNavGroups.flatMap((group) => group.items)
