import type {
  AttachmentPurpose,
  AttachmentVisibility,
  ClaimKind,
  ObservationVisibility,
} from '@mr/shared'
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
import { clientSubmissions } from './client-submissions.js'
import { intakeOrders } from './intake-orders.js'

/**
 * Polymorphic attachments: exactly one of emotive_claim_id / domace_claim_id /
 * client_submission_id / intake_order_id is set. For claim attachments claim_kind mirrors
 * which claim FK is non-null and CASCADE deletes when the parent claim is removed; a
 * client-submission attachment sets only client_submission_id and leaves claim_kind NULL
 * (on conversion the attachment is re-associated to the created claim and claim_kind is
 * set — see docs/18); a vehicle-intake photo sets only intake_order_id (docs/25).
 *
 * Intake photos need no new `purpose` value — `intake_order_id IS NOT NULL` already
 * identifies them, so widening that CHECK too would be redundant.
 */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    claimKind: text('claim_kind').$type<ClaimKind>(),
    emotiveClaimId: uuid('emotive_claim_id'),
    domaceClaimId: uuid('domace_claim_id'),
    clientSubmissionId: uuid('client_submission_id'),
    intakeOrderId: uuid('intake_order_id'),
    /**
     * Points at a damage's `id` inside `intake_orders.damages`, so the photo shows that
     * damage's number. Deliberately nullable and deliberately NOT a foreign key: deleting
     * a damage sets this back to NULL and the photo survives as a general one — deleting a
     * marker must never destroy evidence (docs/25 §3.4).
     */
    intakeDamageId: text('intake_damage_id'),
    fileName: text('file_name').notNull(),
    storagePath: text('storage_path').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    contentSha256: text('content_sha256'),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: integer('duration_seconds'),
    thumbnailPath: text('thumbnail_path'),
    caption: text('caption'),
    visibility: text('visibility').notNull().default('internal').$type<AttachmentVisibility>(),
    purpose: text('purpose').notNull().default('claim_attachment').$type<AttachmentPurpose>(),
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
         AND ${t.domaceClaimId} IS NULL AND ${t.clientSubmissionId} IS NULL
         AND ${t.intakeOrderId} IS NULL)
        OR
        (${t.claimKind} = 'domace' AND ${t.emotiveClaimId} IS NULL
         AND ${t.domaceClaimId} IS NOT NULL AND ${t.clientSubmissionId} IS NULL
         AND ${t.intakeOrderId} IS NULL)
        OR
        (${t.claimKind} IS NULL AND ${t.clientSubmissionId} IS NOT NULL
         AND ${t.emotiveClaimId} IS NULL AND ${t.domaceClaimId} IS NULL
         AND ${t.intakeOrderId} IS NULL)
        OR
        (${t.claimKind} IS NULL AND ${t.intakeOrderId} IS NOT NULL
         AND ${t.emotiveClaimId} IS NULL AND ${t.domaceClaimId} IS NULL
         AND ${t.clientSubmissionId} IS NULL)
      `,
    ),
    // A damage reference is meaningless without the intake order it lives on.
    check(
      'attachments_intake_damage_requires_order_check',
      sql`${t.intakeDamageId} IS NULL OR ${t.intakeOrderId} IS NOT NULL`,
    ),
    check('attachments_visibility_check', sql`${t.visibility} IN ('internal', 'client_visible')`),
    check(
      'attachments_purpose_check',
      sql`${t.purpose} IN ('claim_attachment', 'report_image', 'intake_quote')`,
    ),
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
      name: 'attachments_client_submission_id_fkey',
      columns: [t.clientSubmissionId],
      foreignColumns: [clientSubmissions.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'attachments_intake_order_id_fkey',
      columns: [t.intakeOrderId],
      foreignColumns: [intakeOrders.id],
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
    index('idx_attachments_client_submission_id')
      .on(t.clientSubmissionId)
      .where(sql`${t.clientSubmissionId} IS NOT NULL`),
    index('idx_attachments_intake_order_id')
      .on(t.intakeOrderId)
      .where(sql`${t.intakeOrderId} IS NOT NULL`),
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
  clientSubmission: one(clientSubmissions, {
    fields: [attachments.clientSubmissionId],
    references: [clientSubmissions.id],
  }),
  intakeOrder: one(intakeOrders, {
    fields: [attachments.intakeOrderId],
    references: [intakeOrders.id],
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
