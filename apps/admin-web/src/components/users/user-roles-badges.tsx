import {
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_SERVISER,
  SYSTEM_ROLE_VIEWER,
  rolesListOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { BADGE_SHELL_CLASSES, useLocale } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

const ROLE_LABEL: Record<string, () => string> = {
  [SYSTEM_ROLE_ADMIN]: () => m.users_role_admin(),
  [SYSTEM_ROLE_OPERATOR]: () => m.users_role_operator(),
  [SYSTEM_ROLE_VIEWER]: () => m.users_role_viewer(),
  [SYSTEM_ROLE_CLIENT]: () => m.users_role_client(),
  [SYSTEM_ROLE_SERVISER]: () => m.users_role_serviser(),
}

/**
 * Role badge colors via brandbook mr-* tokens (same class shape as OUTCOME_BADGE_CLASSES).
 *
 * `serviser` is amber, the same reasoning that lets admin be red next to a rejected badge: a
 * role badge only exists once the account is approved, so amber-role and the amber
 * "pending" status badge can never appear in the same row. Green would have collided
 * constantly — every approved serviser would show a green role beside a green status.
 */
const ROLE_CLASSES: Record<string, string> = {
  [SYSTEM_ROLE_ADMIN]:
    'border-mr-brand/45 bg-mr-brand-subtle text-mr-brand-strong shadow-sm shadow-mr-brand/15 dark:border-mr-brand/55 dark:bg-mr-brand/20 dark:text-mr-brand-400 dark:shadow-mr-brand/10',
  [SYSTEM_ROLE_OPERATOR]:
    'border-mr-info/45 bg-mr-info-subtle text-mr-info-strong shadow-sm shadow-mr-info/15 dark:border-mr-info/55 dark:bg-mr-info/20 dark:text-mr-info dark:shadow-mr-info/10',
  [SYSTEM_ROLE_VIEWER]:
    'border-mr-neutral-border bg-mr-neutral-subtle text-mr-neutral-muted shadow-sm dark:border-mr-neutral-muted/45 dark:bg-mr-neutral-muted/20 dark:text-mr-neutral-border',
  [SYSTEM_ROLE_CLIENT]:
    'border-mr-accent/45 bg-mr-accent-subtle text-mr-accent-strong shadow-sm shadow-mr-accent/15 dark:border-mr-accent/55 dark:bg-mr-accent/20 dark:text-mr-accent dark:shadow-mr-accent/10',
  [SYSTEM_ROLE_SERVISER]:
    'border-mr-warning/45 bg-mr-warning-subtle text-mr-warning-strong shadow-sm shadow-mr-warning/15 dark:border-mr-warning/55 dark:bg-mr-warning/20 dark:text-mr-warning dark:shadow-mr-warning/10',
}

const ROLE_DISPLAY_ORDER = [
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_SERVISER,
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

/**
 * Reads the set list itself rather than taking names as a prop: it renders once per table row, and
 * React Query serves every one of them from a single fetch on the shared key. Threading a
 * `nameByCode` map down would have been a twentieth prop on `UsersTable` for the same result.
 *
 * The names matter as of R-6. Before it, only five codes could be held and all five had a hand
 * written label below; now a person can hold any of 26, and without this a standard set rendered
 * as its raw code — `intake_office` instead of "Prijem — kancelarija".
 */
export function UserRolesBadges({ roles }: UserRolesBadgesProps): ReactElement {
  const { locale } = useLocale()
  const { data: catalogue } = useQuery(rolesListOptions())
  const nameByCode = new Map(
    (catalogue ?? []).map((role) => [role.code, locale === 'en' ? role.nameEn : role.nameSr]),
  )

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
          {ROLE_LABEL[role]?.() ?? nameByCode.get(role) ?? role}
        </span>
      ))}
    </div>
  )
}
