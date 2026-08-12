import type {
  IntakeArrivalMode,
  IntakeChecklist,
  IntakeDamage,
  IntakeExtraChecklistItem,
  IntakeOrderStatus,
  IntakeVehicleType,
} from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'

/**
 * Vehicle service intake — the digital "radni nalog za servis" (docs/25).
 *
 * A new subsystem, NOT a claim family: no MR number, no faults, no outcome, no
 * portal. It exists to prove the vehicle's condition at intake, which is why the
 * damage map, photos and both signatures are structural rather than optional.
 *
 * Owner and vehicle are plain columns on purpose. A `vehicles` registry would
 * turn every mistyped plate into a ghost row somebody has to merge by hand, and
 * `customers` carries portal links and claim visibility — a walk-in private
 * individual must never land there.
 *
 * `signed_at IS NULL` means the intake is still being filled in: it stays out of
 * the office's working list and out of the KPI counts, while its own serviser
 * sees it as an unfinished row he can resume (docs/25 §3.3).
 */
export const intakeOrders = pgTable(
  'intake_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** As typed off the printed pad, e.g. `RN-0249/26`. Format deliberately unvalidated — pads vary. */
    orderNumber: text('order_number').notNull(),
    /** Normalized (trim + uppercase) for the uniqueness check and the duplicate warning. */
    orderNumberKey: text('order_number_key').notNull(),
    status: text('status').notNull().default('primljeno').$type<IntakeOrderStatus>(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    /** The serviser: drives the own-only row scope and labels the technician signature. */
    technicianId: uuid('technician_id').notNull(),
    vehicleType: text('vehicle_type').notNull().default('auto').$type<IntakeVehicleType>(),
    plate: text('plate').notNull(),
    /** Normalized (uppercase, non-alphanumerics stripped) — the plate lookup key. */
    plateKey: text('plate_key').notNull(),
    /** Marka i model. */
    vehicle: text('vehicle').notNull(),
    vin: text('vin'),
    mileage: integer('mileage'),
    arrivalMode: text('arrival_mode').notNull().$type<IntakeArrivalMode>(),
    /** A person or a firm — intake does not care which. */
    ownerName: text('owner_name').notNull(),
    ownerAddress: text('owner_address'),
    ownerPhone: text('owner_phone').notNull(),
    /**
     * A second number the shop may write down AFTER signing, when the signed one turns out to be
     * wrong. `owner_phone` is evidence and is never overwritten (docs/25 §5): the owner walks out
     * holding a printed sheet, so the number on it must keep matching the record. This is the
     * shop's working note — never printed, internal only, and only ever set on a signed order.
     */
    contactPhone: text('contact_phone'),
    ownerRemarks: text('owner_remarks'),
    /** Fuel gauge in eighths, as the paper form draws it. */
    fuelLevel: integer('fuel_level').notNull().default(4),
    checklist: jsonb('checklist').notNull().$type<IntakeChecklist>(),
    /**
     * Equipment rows the serviser wrote in because the catalog does not offer them. NOT folded into
     * `checklist`: that map is keyed by the admin's catalog codes and the service refuses a code the
     * catalog does not know, so a written-in row would have to be given one — and the moment it has
     * a code, the catalog has stopped being the admin's.
     */
    extraChecklist: jsonb('extra_checklist')
      .notNull()
      .default([])
      .$type<IntakeExtraChecklistItem[]>(),
    equipmentNote: text('equipment_note'),
    /** Array order IS the ①②③ numbering on map, defect list and print. */
    damages: jsonb('damages').notNull().$type<IntakeDamage[]>(),
    /**
     * Defects with no place on the silhouette — wheels, interior, exhaust. Not in `damages`, which
     * needs `x`, `y`, `zone` and `type`: letting those be empty would mean an empty-value guard in
     * five places (the drawing, the ①②③ numbering, the printed markers, photo linking, and the
     * server's zone re-derivation) instead of one column here.
     */
    extraDamages: jsonb('extra_damages').notNull().default([]).$type<string[]>(),
    services: jsonb('services').notNull().$type<string[]>(),
    materials: jsonb('materials').notNull().$type<string[]>(),
    /**
     * How far the wizard got (1–5), NULL once signed. The server holds this, not
     * the tablet: the "stao si na koraku N od 5" banner and the colleague's
     * number-collision warning cannot be told honestly from another device's
     * localStorage.
     */
    draftStep: integer('draft_step'),
    /**
     * How many photos the tablet held at signing. The "not all photos arrived"
     * indicator is `count(attachments) < photos_expected` — without it the server
     * cannot tell "3 photos, that's all" from "3 of 7 arrived".
     */
    photosExpected: integer('photos_expected'),
    /** SVG path text normalized to a 460×200 space — vector, so A4 prints sharp. */
    technicianSignature: text('technician_signature'),
    ownerSignature: text('owner_signature'),
    /** NULL = draft. Set once both signatures are in and the intake is finished. */
    signedAt: timestamp('signed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      'intake_orders_status_check',
      sql`${t.status} IN ('primljeno', 'u_radu', 'gotovo', 'preuzeto')`,
    ),
    check(
      'intake_orders_vehicle_type_check',
      sql`${t.vehicleType} IN ('auto', 'kombi', 'kamionet', 'dzip')`,
    ),
    check(
      'intake_orders_arrival_mode_check',
      sql`${t.arrivalMode} IN ('dovezeno', 'doslepano', 'dovuceno')`,
    ),
    check('intake_orders_fuel_level_check', sql`${t.fuelLevel} BETWEEN 0 AND 8`),
    check('intake_orders_draft_step_check', sql`${t.draftStep} BETWEEN 1 AND 5`),
    check('intake_orders_photos_expected_check', sql`${t.photosExpected} >= 0`),
    check('intake_orders_mileage_check', sql`${t.mileage} >= 0`),
    foreignKey({
      name: 'intake_orders_technician_id_fkey',
      columns: [t.technicianId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    // A number is taken by any existing row; hard-deleting a draft releases it,
    // exactly like the MR registry's release-on-delete. A signed order can never
    // be deleted, so there is no "hidden" row left to carve out with a WHERE.
    uniqueIndex('uq_intake_orders_order_number_key').on(t.orderNumberKey),
    index('idx_intake_orders_plate_key').on(t.plateKey),
    index('idx_intake_orders_status').on(t.status),
    // The office list's only read shape: signed orders, newest first.
    index('idx_intake_orders_received_at')
      .on(t.receivedAt.desc())
      .where(sql`${t.signedAt} IS NOT NULL`),
    // The serviser's own list — drafts included, so no signed_at predicate here.
    index('idx_intake_orders_technician_id').on(t.technicianId),
  ],
)

export const intakeOrdersRelations = relations(intakeOrders, ({ one }) => ({
  technician: one(users, {
    fields: [intakeOrders.technicianId],
    references: [users.id],
  }),
}))
