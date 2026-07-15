import type { SystemRoleCode } from '../enums.js'

export const SYSTEM_ROLE_ADMIN: SystemRoleCode = 'admin'
export const SYSTEM_ROLE_OPERATOR: SystemRoleCode = 'operator'
export const SYSTEM_ROLE_VIEWER: SystemRoleCode = 'viewer'
export const SYSTEM_ROLE_CLIENT: SystemRoleCode = 'client'

export const SYSTEM_ROLE_CODES: readonly SystemRoleCode[] = [
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_CLIENT,
] as const

/**
 * Roles that can use internal-web. The dashboard and statistics are visible to
 * every internal user (including viewers, whose permissions already grant the
 * underlying data); `client` never has an internal-web session.
 */
export const INTERNAL_APP_ROLES: readonly SystemRoleCode[] = [
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
] as const
