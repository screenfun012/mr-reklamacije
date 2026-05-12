import type { AttachmentVisibility, ClaimKind, ObservationVisibility } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'
import { domaceClaims, emotiveClaims } from './claims.js'

/**
 * Polymorphic attachments: exactly one of emotive_claim_id / domace_claim_id is set.
 * claim_kind mirrors which FK is non-null; CASCADE deletes when parent claim is removed.
 */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    claimKind: text('claim_kind').notNull().$type<ClaimKind>(),
    emotiveClaimId: uuid('emotive_claim_id'),
    domaceClaimId: uuid('domace_claim_id'),
    fileName: text('file_name').notNull(),
    storagePath: text('storage_path').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: integer('duration_seconds'),
    thumbnailPath: text('thumbnail_path'),
    caption: text('caption'),
    visibility: text('visibility').notNull().default('internal').$type<AttachmentVisibility>(),
    uploadedBy: uuid('uploaded_by'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    check('attachments_claim_kind_check', sql`${t.claimKind} IN ('emotive', 'domace')`),
    check(
      'attachments_one_of_claim_check',
      sql`
        (${t.claimKind} = 'emotive' AND ${t.emotiveClaimId} IS NOT NULL
         AND ${t.domaceClaimId} IS NULL)
        OR
        (${t.claimKind} = 'domace' AND ${t.emotiveClaimId} IS NULL
         AND ${t.domaceClaimId} IS NOT NULL)
      `,
    ),
    check('attachments_visibility_check', sql`${t.visibility} IN ('internal', 'client_visible')`),
    foreignKey({
      name: 'attachments_emotive_claim_id_fkey',
      columns: [t.emotiveClaimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'attachments_domace_claim_id_fkey',
      columns: [t.domaceClaimId],
      foreignColumns: [domaceClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'attachments_uploaded_by_fkey',
      columns: [t.uploadedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    index('idx_attachments_uploaded_at').on(t.uploadedAt.desc()),
    index('idx_attachments_emotive_claim_id')
      .on(t.emotiveClaimId)
      .where(sql`${t.emotiveClaimId} IS NOT NULL`),
    index('idx_attachments_domace_claim_id')
      .on(t.domaceClaimId)
      .where(sql`${t.domaceClaimId} IS NOT NULL`),
  ],
)

export const claimObservations = pgTable(
  'claim_observations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    claimKind: text('claim_kind').notNull().$type<ClaimKind>(),
    emotiveClaimId: uuid('emotive_claim_id'),
    domaceClaimId: uuid('domace_claim_id'),
    body: text('body').notNull(),
    visibility: text('visibility').notNull().$type<ObservationVisibility>(),
    authorId: uuid('author_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true, mode: 'date' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    check('claim_observations_claim_kind_check', sql`${t.claimKind} IN ('emotive', 'domace')`),
    check(
      'claim_observations_one_of_claim_check',
      sql`
        (${t.claimKind} = 'emotive' AND ${t.emotiveClaimId} IS NOT NULL
         AND ${t.domaceClaimId} IS NULL)
        OR
        (${t.claimKind} = 'domace' AND ${t.emotiveClaimId} IS NULL
         AND ${t.domaceClaimId} IS NOT NULL)
      `,
    ),
    check(
      'claim_observations_visibility_check',
      sql`${t.visibility} IN ('internal', 'client_visible')`,
    ),
    foreignKey({
      name: 'claim_observations_emotive_claim_id_fkey',
      columns: [t.emotiveClaimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'claim_observations_domace_claim_id_fkey',
      columns: [t.domaceClaimId],
      foreignColumns: [domaceClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'claim_observations_author_id_fkey',
      columns: [t.authorId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    index('idx_claim_observations_emotive_claim_id')
      .on(t.emotiveClaimId)
      .where(sql`${t.emotiveClaimId} IS NOT NULL`),
    index('idx_claim_observations_domace_claim_id')
      .on(t.domaceClaimId)
      .where(sql`${t.domaceClaimId} IS NOT NULL`),
  ],
)

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  emotiveClaim: one(emotiveClaims, {
    fields: [attachments.emotiveClaimId],
    references: [emotiveClaims.id],
  }),
  domaceClaim: one(domaceClaims, {
    fields: [attachments.domaceClaimId],
    references: [domaceClaims.id],
  }),
  uploader: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}))

export const claimObservationsRelations = relations(claimObservations, ({ one }) => ({
  emotiveClaim: one(emotiveClaims, {
    fields: [claimObservations.emotiveClaimId],
    references: [emotiveClaims.id],
  }),
  domaceClaim: one(domaceClaims, {
    fields: [claimObservations.domaceClaimId],
    references: [domaceClaims.id],
  }),
  author: one(users, {
    fields: [claimObservations.authorId],
    references: [users.id],
  }),
}))
