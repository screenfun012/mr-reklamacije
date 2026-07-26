import type { SystemRoleCode } from '../enums.js'

import {
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_SERVISER,
  SYSTEM_ROLE_VIEWER,
} from './roles.js'

/**
 * Internal staff roles that can be freely toggled on an already-approved user
 * (admin excluded). `client` is intentionally NOT here: it is a special role that
 * requires a linked customer, so it must never be a free toggle in role editing.
 *
 * `serviser` IS here: granting a shop worker tablet access is exactly this toggle,
 * and it needs no linked record of any kind.
 */
export const APPROVE_REGISTRATION_ROLE_CODES = [
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_SERVISER,
] as const satisfies readonly SystemRoleCode[]

export type ApproveRegistrationRoleCode = (typeof APPROVE_REGISTRATION_ROLE_CODES)[number]

export const DEFAULT_APPROVE_REGISTRATION_ROLE: ApproveRegistrationRoleCode = SYSTEM_ROLE_OPERATOR

/**
 * Roles a pending registration can be approved INTO. Superset of the internal
 * staff roles plus `client`. Approving as `client` additionally requires linking
 * at least one customer (enforced in the account-status schema + service).
 */
export const ACCOUNT_APPROVAL_ROLE_CODES = [
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_SERVISER,
  SYSTEM_ROLE_CLIENT,
] as const satisfies readonly SystemRoleCode[]

export type AccountApprovalRoleCode = (typeof ACCOUNT_APPROVAL_ROLE_CODES)[number]
