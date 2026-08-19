import {
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_SERVISER,
  SYSTEM_ROLE_VIEWER,
  rolesListOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { useLocale } from '@mr/ui'
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
 * The five sets that predate the panel keep the brandbook's hues (docs/09 §badge palette); the
 * twenty-one that came with it are neutral chips — twenty-six colours would be a rainbow, and the
 * one that has to be recognisable across the room is `admin`.
 *
 * `serviser` is amber for the same reason `admin` may be red beside a rejected badge: a role chip
 * only exists once an account is approved, so it can never sit next to the amber "pending" status.
 */
const ROLE_CLASSES: Record<string, string> = {
  [SYSTEM_ROLE_ADMIN]: 'bg-mr-brand/[0.13] text-adm-red-h',
  [SYSTEM_ROLE_OPERATOR]: 'bg-adm-blu/15 text-adm-blu',
  [SYSTEM_ROLE_VIEWER]: 'bg-adm-gry/20 text-adm-gry',
  [SYSTEM_ROLE_CLIENT]: 'bg-adm-teal/15 text-adm-teal',
  [SYSTEM_ROLE_SERVISER]: 'bg-adm-amb/15 text-adm-amb',
}

/** Everything built in the panel: quiet, outlined, and never wrapping mid-name. */
const NEUTRAL_ROLE = 'border border-mr-border-strong bg-adm-inbg text-muted-foreground'

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
    <div className="flex flex-wrap gap-1">
      {sorted.map((role) => (
        <span
          key={role}
          className={`whitespace-nowrap rounded-full px-2 py-[3px] font-mono text-[9.5px] font-semibold ${ROLE_CLASSES[role] ?? NEUTRAL_ROLE}`}
        >
          {ROLE_LABEL[role]?.() ?? nameByCode.get(role) ?? role}
        </span>
      ))}
    </div>
  )
}
