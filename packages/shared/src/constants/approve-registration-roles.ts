import type { SystemRoleCode } from '../enums.js'

import { SYSTEM_ROLE_OPERATOR, SYSTEM_ROLE_VIEWER } from './roles.js'

/** Roles assignable during self-service registration approval (admin excluded). */
export const APPROVE_REGISTRATION_ROLE_CODES = [
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
] as const satisfies readonly SystemRoleCode[]

export type ApproveRegistrationRoleCode = (typeof APPROVE_REGISTRATION_ROLE_CODES)[number]

export const DEFAULT_APPROVE_REGISTRATION_ROLE: ApproveRegistrationRoleCode = SYSTEM_ROLE_OPERATOR
