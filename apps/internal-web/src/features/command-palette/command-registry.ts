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
  permissions: readonly string[]
}

/**
 * ONE create command. It used to be two, because the kind of claim was the route you picked; the
 * wizard asks that as its first step now, so the palette offers the door and not the two rooms
 * behind it. Either permission opens it — the step shows only the cards the actor may use.
 */
export const commandPaletteActionItems: readonly PaletteActionItem[] = [
  {
    key: 'nova-reklamacija',
    label: m.crumb_new_claim,
    to: '/reklamacije/nova',
    permissions: ['emotive_claims.create', 'domace_claims.create'],
  },
]
