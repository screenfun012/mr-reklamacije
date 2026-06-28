import {
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { BADGE_SHELL_CLASSES } from '@mr/ui'
import type { ReactElement } from 'react'

const ROLE_LABEL: Record<string, () => string> = {
  [SYSTEM_ROLE_ADMIN]: () => m.users_role_admin(),
  [SYSTEM_ROLE_OPERATOR]: () => m.users_role_operator(),
  [SYSTEM_ROLE_VIEWER]: () => m.users_role_viewer(),
  [SYSTEM_ROLE_CLIENT]: () => m.users_role_client(),
}

/** Role badge colors via brandbook mr-* tokens (same class shape as OUTCOME_BADGE_CLASSES). */
const ROLE_CLASSES: Record<string, string> = {
  [SYSTEM_ROLE_ADMIN]:
    'border-mr-brand/45 bg-mr-brand-subtle text-mr-brand-strong shadow-sm shadow-mr-brand/15 dark:border-mr-brand/55 dark:bg-mr-brand/20 dark:text-mr-brand-400 dark:shadow-mr-brand/10',
  [SYSTEM_ROLE_OPERATOR]:
    'border-mr-info/45 bg-mr-info-subtle text-mr-info-strong shadow-sm shadow-mr-info/15 dark:border-mr-info/55 dark:bg-mr-info/20 dark:text-mr-info dark:shadow-mr-info/10',
  [SYSTEM_ROLE_VIEWER]:
    'border-mr-neutral-border bg-mr-neutral-subtle text-mr-neutral-muted shadow-sm dark:border-mr-neutral-muted/45 dark:bg-mr-neutral-muted/20 dark:text-mr-neutral-border',
  [SYSTEM_ROLE_CLIENT]:
    'border-mr-accent/45 bg-mr-accent-subtle text-mr-accent-strong shadow-sm shadow-mr-accent/15 dark:border-mr-accent/55 dark:bg-mr-accent/20 dark:text-mr-accent dark:shadow-mr-accent/10',
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
          className={`${BADGE_SHELL_CLASSES} ${ROLE_CLASSES[role] ?? 'border-border bg-muted/40 text-muted-foreground'}`}
        >
          {ROLE_LABEL[role]?.() ?? role}
        </span>
      ))}
    </div>
  )
}
