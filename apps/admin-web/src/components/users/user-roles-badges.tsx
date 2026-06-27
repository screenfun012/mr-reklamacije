import {
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
} from '@mr/shared'
import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

const BADGE_SHELL = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium'

const ROLE_LABEL: Record<string, () => string> = {
  [SYSTEM_ROLE_ADMIN]: () => m.users_role_admin(),
  [SYSTEM_ROLE_OPERATOR]: () => m.users_role_operator(),
  [SYSTEM_ROLE_VIEWER]: () => m.users_role_viewer(),
  [SYSTEM_ROLE_CLIENT]: () => m.users_role_client(),
}

const ROLE_CLASSES: Record<string, string> = {
  [SYSTEM_ROLE_ADMIN]: 'border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200',
  [SYSTEM_ROLE_OPERATOR]: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  [SYSTEM_ROLE_VIEWER]: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200',
  [SYSTEM_ROLE_CLIENT]: 'border-teal-500/30 bg-teal-500/10 text-teal-800 dark:text-teal-200',
}

const ROLE_DISPLAY_ORDER = [
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_CLIENT,
] as const

function sortRolesForDisplay(roles: readonly string[]): string[] {
  const unique = [...new Set(roles)]
  return unique.sort((a, b) => {
    const aIndex = ROLE_DISPLAY_ORDER.indexOf(a as (typeof ROLE_DISPLAY_ORDER)[number])
    const bIndex = ROLE_DISPLAY_ORDER.indexOf(b as (typeof ROLE_DISPLAY_ORDER)[number])
    const aOrder = aIndex === -1 ? ROLE_DISPLAY_ORDER.length : aIndex
    const bOrder = bIndex === -1 ? ROLE_DISPLAY_ORDER.length : bIndex
    return aOrder - bOrder
  })
}

export interface UserRolesBadgesProps {
  roles: readonly string[]
}

export function UserRolesBadges({ roles }: UserRolesBadgesProps): ReactElement {
  if (roles.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const sorted = sortRolesForDisplay(roles)

  return (
    <div className="flex flex-wrap gap-1.5">
      {sorted.map((role) => (
        <span
          key={role}
          className={`${BADGE_SHELL} ${ROLE_CLASSES[role] ?? 'border-border bg-muted/40 text-muted-foreground'}`}
        >
          {ROLE_LABEL[role]?.() ?? role}
        </span>
      ))}
    </div>
  )
}
