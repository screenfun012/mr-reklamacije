import { m } from '@mr/i18n'
import { SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_CLIENT, type RoleListItem } from '@mr/shared'

/**
 * Two codes never appear in an assignment list, and neither exclusion is left over from the
 * hardcoded three this replaced:
 *
 * - `admin` because a second administrator is a decision, not a checkbox reached while editing
 *   somebody's roles. The server still accepts it — UI hiding is courtesy — so the capability is
 *   not lost, it just is not one tap away. Nikola's call to change.
 * - `client` because approving somebody as a client also LINKS them to a firm, atomically, in the
 *   approve transaction. Handed out from the roles editor there is no firm, and the result is an
 *   account that signs into the portal and sees nothing.
 */
const NEVER_ASSIGNABLE: readonly string[] = [SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_CLIENT]

/**
 * Descriptions for the five sets that predate the panel. Their wording was written for the approve
 * screen and is worth more than an empty line — the `roles` table has a `description` column but
 * the seed leaves it null, and a set built in the panel carries its author's own.
 *
 * A lookup MISS is normal and silent: the 21 standard sets simply show no description. It gates
 * nothing — the list itself comes from the server.
 */
const LEGACY_DESCRIPTION: Record<string, () => string> = {
  operator: () => m.users_role_operator_description(),
  viewer: () => m.users_role_viewer_description(),
  serviser: () => m.users_role_serviser_description(),
  client: () => m.users_role_client_description(),
}

export interface AssignableRole {
  code: string
  name: string
  description: string | null
}

export function toAssignableRoles(
  roles: readonly RoleListItem[],
  locale: string,
  options: { includeClient?: boolean } = {},
): AssignableRole[] {
  const allowClient = options.includeClient ?? false

  return roles
    .filter(
      (role) =>
        !NEVER_ASSIGNABLE.includes(role.code) || (allowClient && role.code === SYSTEM_ROLE_CLIENT),
    )
    .map((role) => ({
      code: role.code,
      name: locale === 'en' ? role.nameEn : role.nameSr,
      description: role.description ?? LEGACY_DESCRIPTION[role.code]?.() ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale === 'en' ? 'en' : 'sr'))
}
