import { m } from '@mr/i18n'
import { FilePlus2, Shield } from 'lucide-react'

import { internalNavItems, type NavItem } from '~/config/navigation'

const paletteExtraItems: readonly NavItem[] = [
  {
    key: 'nova-emotive',
    label: m.nav_nova_emotive,
    to: '/reklamacije/emotive/nova',
    icon: FilePlus2,
    permission: 'emotive_claims.create',
  },
  {
    key: 'nova-domace',
    label: m.nav_nova_domace,
    to: '/reklamacije/domace/nova',
    icon: FilePlus2,
    permission: 'domace_claims.create',
  },
  {
    key: 'bezbednost',
    label: m.nav_security,
    to: '/settings/security',
    icon: Shield,
  },
]

/** All navigation targets offered by the command palette (sidebar items + create/security). */
export const commandPaletteNavItems: readonly NavItem[] = [
  ...internalNavItems,
  ...paletteExtraItems,
]
