import { z } from 'zod'

import {
  RoleCodeSchema,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_VIEWER,
} from '../constants/roles.js'
import { UserAccountStatus } from '../enums.js'

import { ReferenceListQuerySchema, ReferenceListResponseSchema } from './reference-data.schema.js'

const userAccountStatusValues = [
  UserAccountStatus.Pending,
  UserAccountStatus.Approved,
  UserAccountStatus.Rejected,
] as const

export const UsersListQuerySchema = ReferenceListQuerySchema.extend({
  accountStatus: z.enum(userAccountStatusValues).optional(),
})

export type UsersListQuery = z.infer<typeof UsersListQuerySchema>

export const UserListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  accountStatus: z.enum(userAccountStatusValues),
  createdAt: z.string(),
  roles: z.array(z.string()),
  /** Free-text company a client typed at portal registration; null for staff. */
  requestedCompany: z.string().nullable(),
  /** false = deactivated: kept in the list but blocked from signing in. */
  isActive: z.boolean(),
})

export type UserListItem = z.infer<typeof UserListItemSchema>

/**
 * Account-status PATCH response: the user plus, when a client was just approved,
 * whether the activation email was sent (`null` when not applicable). Superset of
 * UserListItem so existing consumers keep working.
 */
export const UserAccountStatusResultSchema = UserListItemSchema.extend({
  activationEmailSent: z.boolean().nullable(),
})

export type UserAccountStatusResult = z.infer<typeof UserAccountStatusResultSchema>

export const UserListResponseSchema = ReferenceListResponseSchema(UserListItemSchema)

export type UserListResponse = z.infer<typeof UserListResponseSchema>

export const UserAccountStatusPatchInputSchema = z
  .object({
    status: z.enum([UserAccountStatus.Approved, UserAccountStatus.Rejected]),
    /**
     * The packages the account is approved with — several at once, because rights ADD UP and a
     * person normally needs two or three small ones (docs `2026-08-17-roles-admin-panel-design`).
     * Approving used to take exactly one, which meant every approval was followed by opening the
     * roles editor to add the rest.
     *
     * Any live set EXCEPT admin: approving a registration must never mint an administrator. That
     * was true when this was a four-code enum and it is the one part of the closed list worth
     * keeping. Everything else is data now, so the service checks each set is live and grantable.
     */
    roleCodes: z
      .array(
        RoleCodeSchema.refine((code) => code !== SYSTEM_ROLE_ADMIN, {
          message: 'Nalog se ne može odobriti kao administrator.',
        }),
      )
      .optional(),
    customerIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === UserAccountStatus.Rejected) {
      if (value.roleCodes !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'roleCodes is only allowed when approving',
          path: ['roleCodes'],
        })
      }
      if (value.customerIds !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'customerIds is only allowed when approving',
          path: ['customerIds'],
        })
      }
      return
    }

    if (value.roleCodes === undefined || value.roleCodes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'roleCodes is required when approving',
        path: ['roleCodes'],
      })
      return
    }

    if (value.roleCodes.includes(SYSTEM_ROLE_CLIENT)) {
      /*
       * A portal client is not a colleague with an extra package. The client set is what makes an
       * account see the portal and NOTHING else; combined with a staff package the same account
       * would hold internal rights and a firm link at once, which is a shape no screen in this
       * system was designed for. One or the other, decided here rather than discovered later.
       */
      if (value.roleCodes.length > 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Klijent se ne može kombinovati sa drugim ovlašćenjima.',
          path: ['roleCodes'],
        })
      }
      if (value.customerIds === undefined || value.customerIds.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'customerIds is required when approving a client',
          path: ['customerIds'],
        })
      }
    } else if (value.customerIds !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'customerIds is only allowed for the client role',
        path: ['customerIds'],
      })
    }
  })
  .transform((value) => {
    if (value.status === UserAccountStatus.Approved) {
      // superRefine rejects an approval without a package, so the list is always non-empty here;
      // the fallback is unreachable and least-privilege (never operator).
      const roleCodes =
        value.roleCodes === undefined || value.roleCodes.length === 0
          ? [SYSTEM_ROLE_VIEWER]
          : [...new Set(value.roleCodes)]
      const customerIds = roleCodes.includes(SYSTEM_ROLE_CLIENT)
        ? [...new Set(value.customerIds ?? [])]
        : []

      return {
        status: value.status,
        roleCodes,
        customerIds,
      }
    }

    return { status: value.status }
  })

/** Parsed (post-transform) shape used by the API service. */
export type UserAccountStatusPatchInput = z.infer<typeof UserAccountStatusPatchInputSchema>

/**
 * Request body shape the client sends (pre-transform): `customerIds` is optional
 * and must be omitted for non-client roles — the schema rejects it otherwise.
 */
export type UserAccountStatusPatchBody = z.input<typeof UserAccountStatusPatchInputSchema>

export const UserIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type UserIdParam = z.infer<typeof UserIdParamSchema>

/** Password policy — mirrors Better-Auth `emailAndPassword` config (options.ts). */
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

export const UserPasswordResetInputSchema = z.object({
  newPassword: PasswordSchema,
})

export type UserPasswordResetInput = z.infer<typeof UserPasswordResetInputSchema>

export const UserSetActiveInputSchema = z.object({
  isActive: z.boolean(),
})

export type UserSetActiveInput = z.infer<typeof UserSetActiveInputSchema>

export const UserRolesReplaceInputSchema = z.object({
  roleCodes: z
    .array(RoleCodeSchema)
    .min(1)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: 'Duplicate role codes are not allowed',
    }),
})

export type UserRolesReplaceInput = z.infer<typeof UserRolesReplaceInputSchema>
