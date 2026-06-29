import { z } from 'zod'

import { AUDIT_ACTIONS } from '../constants/audit.js'

import { ReferenceListResponseSchema } from './reference-data.schema.js'

const auditActionValues = AUDIT_ACTIONS

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const AuditLogListQuerySchema = z.object({
  actorUserId: z.string().uuid().optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  entityId: z.string().uuid().optional(),
  action: z.enum(auditActionValues).optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  cursor: z.string().trim().min(1).optional(),
})

export type AuditLogListQuery = z.infer<typeof AuditLogListQuerySchema>

export const AuditLogActorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
})

export type AuditLogActor = z.infer<typeof AuditLogActorSchema>

export const AuditLogListItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  action: z.enum(auditActionValues),
  entityType: z.string(),
  entityId: z.string().uuid(),
  /** Resolved actor (null for system events or deleted actors). */
  actor: AuditLogActorSchema.nullable(),
  actorIp: z.string().nullable(),
  actorUserAgent: z.string().nullable(),
  /** Free-form per-action payload — never assume a fixed shape when rendering. */
  changes: z.unknown().nullable(),
  context: z.unknown().nullable(),
})

export type AuditLogListItem = z.infer<typeof AuditLogListItemSchema>

export const AuditLogListResponseSchema = ReferenceListResponseSchema(AuditLogListItemSchema)

export type AuditLogListResponse = z.infer<typeof AuditLogListResponseSchema>
