import type { AuditAction } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'

// TODO (Phase 1 optimization): Add BRIN index on created_at for time-range queries once audit_log grows past ~1M rows. Drizzle-kit may not generate BRIN syntax reliably — write migration manually:
// CREATE INDEX idx_audit_log_created_at_brin ON audit_log USING BRIN (created_at);

// Retention policy (per docs/02-data-model.md): 2 years online, then cold archive to NAS. Implementation deferred to Phase 1 (requires scheduled job + archive storage setup).

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull().$type<AuditAction>(),
    actorUserId: uuid('actor_user_id'),
    actorIp: inet('actor_ip'),
    actorUserAgent: text('actor_user_agent'),
    changes: jsonb('changes'),
    context: jsonb('context'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'audit_log_actor_user_id_fkey',
      columns: [t.actorUserId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    check(
      'audit_log_action_check',
      sql`${t.action} IN ('create', 'update', 'delete', 'restore', 'login', 'logout', 'permission_change', 'export', 'import')`,
    ),
    index('idx_audit_log_entity_type_entity_id_created_at').on(
      t.entityType,
      t.entityId,
      t.createdAt.desc(),
    ),
    index('idx_audit_log_actor_user_id_created_at').on(t.actorUserId, t.createdAt.desc()),
    index('idx_audit_log_action_created_at').on(t.action, t.createdAt.desc()),
  ],
)

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actorUser: one(users, {
    fields: [auditLog.actorUserId],
    references: [users.id],
  }),
}))
