import { m } from '@mr/i18n'
import { Shield } from 'lucide-react'

import { internalNavItems, type NavItem } from '~/config/navigation'

/**
 * Palette navigation: the sidebar's screens in the sidebar's own order (the rows
 * are numbered, so the two must not drift), plus Security, which the sidebar
 * keeps in its footer rather than in the main list.
 */
export const commandPaletteNavItems: readonly NavItem[] = [
  ...internalNavItems,
  {
    key: 'bezbednost',
    label: m.nav_security,
    to: '/settings/security',
    icon: Shield,
  },
]

/**
 * Palette actions: things the palette *creates* rather than navigates to. They
 * render as a red `+` instead of an icon, so — unlike a nav item — they carry no
 * icon component.
 */
export interface PaletteActionItem {
  key: string
  label: () => string
  to: string
  permission: string
}

export const commandPaletteActionItems: readonly PaletteActionItem[] = [
  {
    key: 'nova-emotive',
    label: m.nav_nova_emotive,
    to: '/reklamacije/emotive/nova',
    permission: 'emotive_claims.create',
  },
  {
    key: 'nova-domace',
    label: m.nav_nova_domace,
    to: '/reklamacije/domace/nova',
    permission: 'domace_claims.create',
  },
]
