import { z } from 'zod'

import type { SystemRoleCode } from '../enums.js'

export const SYSTEM_ROLE_ADMIN: SystemRoleCode = 'admin'
export const SYSTEM_ROLE_OPERATOR: SystemRoleCode = 'operator'
export const SYSTEM_ROLE_VIEWER: SystemRoleCode = 'viewer'
export const SYSTEM_ROLE_CLIENT: SystemRoleCode = 'client'
export const SYSTEM_ROLE_SERVISER: SystemRoleCode = 'serviser'

export const SYSTEM_ROLE_CODES: readonly SystemRoleCode[] = [
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_SERVISER,
] as const

/**
 * Roles that can use internal-web. The dashboard and statistics are visible to
 * every internal user (including viewers, whose permissions already grant the
 * underlying data); `client` never has an internal-web session.
 *
 * `serviser` belongs here — the intake module lives in internal-web — but sees
 * only "Servis": his permissions gate every other nav item away, and with a
 * single visible entry the sidebar is not rendered at all (docs/25 §3.1).
 */
export const INTERNAL_APP_ROLES: readonly SystemRoleCode[] = [
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_SERVISER,
] as const

/**
 * The shape `RolesService.roleCodeFrom` produces: transliterated, lowercased, non-alphanumerics
 * folded to `_`, trimmed, capped at 40.
 *
 * It exists because the two assignment endpoints can no longer validate against a closed list.
 * Sets are built in the panel now, so the codes a person may be given are DATA — the boundary
 * checks the shape and the SERVICE checks the set is live and grantable, which is the only place
 * that can know. Both repository paths already resolve a code against live, non-deleted rows and
 * refuse an unknown one, so an invented code cannot reach the database whatever the schema says.
 */
export const ROLE_CODE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

export const RoleCodeSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(ROLE_CODE_PATTERN, 'Neispravna šifra ovlašćenja.')
