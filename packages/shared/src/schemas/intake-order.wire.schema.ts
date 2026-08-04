import { z } from 'zod'

import {
  intakeArrivalModeValues,
  intakeOrderStatusValues,
  intakeVehicleTypeValues,
} from '../enums.js'
import { IntakeChecklistSchema, IntakeDamagesSchema } from './intake-order.schema.js'

/**
 * Vehicle service intake — the HTTP boundary (docs/25).
 *
 * Split from `intake-order.schema.ts` on purpose: that file holds the two shapes the
 * database stores inside jsonb (checklist, damages) and is imported by `@mr/db`, which
 * must never pull request/response schemas into the schema layer.
 */

const plateSchema = z.string().trim().min(2).max(20)
const orderNumberSchema = z.string().trim().min(1).max(40)

/**
 * What the wizard knows after step 1, which is when the row is created. Everything else
 * arrives as a patch. `arrivalMode` has no default: the form always has one selected, and
 * inventing a default here would silently record "dovezeno" for a towed wreck.
 */
export const IntakeOrderCreateInputSchema = z.object({
  orderNumber: orderNumberSchema,
  vehicleType: z.enum(intakeVehicleTypeValues),
  plate: plateSchema,
  vehicle: z.string().trim().min(1).max(120),
  vin: z.string().trim().max(40).optional(),
  mileage: z.number().int().min(0).max(10_000_000).optional(),
  arrivalMode: z.enum(intakeArrivalModeValues),
  ownerName: z.string().trim().min(1).max(160),
  ownerAddress: z.string().trim().max(240).optional(),
  ownerPhone: z.string().trim().min(3).max(40),
  ownerRemarks: z.string().trim().max(2000).optional(),
})

export type IntakeOrderCreateInput = z.infer<typeof IntakeOrderCreateInputSchema>

/**
 * A step patch, or an office edit afterwards. Every field optional — the wizard sends only
 * what that step changed, which is also what keeps the tablet's traffic to a few kilobytes.
 *
 * `draftStep` travels with the patch so the server knows how far the intake got; the
 * "stao si na koraku N od 5" banner and the colleague-collision warning read it.
 */
export const IntakeOrderUpdateInputSchema = z
  .object({
    orderNumber: orderNumberSchema.optional(),
    vehicleType: z.enum(intakeVehicleTypeValues).optional(),
    plate: plateSchema.optional(),
    vehicle: z.string().trim().min(1).max(120).optional(),
    vin: z.string().trim().max(40).nullable().optional(),
    mileage: z.number().int().min(0).max(10_000_000).nullable().optional(),
    arrivalMode: z.enum(intakeArrivalModeValues).optional(),
    ownerName: z.string().trim().min(1).max(160).optional(),
    ownerAddress: z.string().trim().max(240).nullable().optional(),
    ownerPhone: z.string().trim().min(3).max(40).optional(),
    ownerRemarks: z.string().trim().max(2000).nullable().optional(),
    fuelLevel: z.number().int().min(0).max(8).optional(),
    checklist: IntakeChecklistSchema.optional(),
    equipmentNote: z.string().trim().max(2000).nullable().optional(),
    damages: IntakeDamagesSchema.optional(),
    services: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
    materials: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
    draftStep: z.number().int().min(1).max(5).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Empty update' })

export type IntakeOrderUpdateInput = z.infer<typeof IntakeOrderUpdateInputSchema>

/**
 * Both signatures plus how many photos the tablet holds. `photosExpected` is the only way
 * the server can later say "not all photos arrived" — it cannot otherwise tell three
 * photos that are all of them from three of seven.
 */
export const IntakeOrderSignInputSchema = z.object({
  technicianSignature: z.string().trim().min(1).max(100_000),
  ownerSignature: z.string().trim().min(1).max(100_000),
  photosExpected: z.number().int().min(0).max(200),
})

export type IntakeOrderSignInput = z.infer<typeof IntakeOrderSignInputSchema>

/** Office-only correction of a mis-tapped status; a serviser uses `/advance` instead. */
/**
 * One line of the order's history. Deliberately a PROJECTION, never the raw audit row: those carry
 * the actor's IP, their user agent and the whole before/after object — signatures included — and
 * the people who need this tab (the serviser, the office) must not be handed any of it.
 */
export const IntakeOrderHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  at: z.string(),
  action: z.string(),
  /** `sign` | `advance` | `change_status` | `amend_after_signing` | … — labelled client-side. */
  transition: z.string().nullable(),
  actorName: z.string().nullable(),
  /** Present only for a status move, so the line can read "U radu → Gotovo". */
  fromStatus: z.string().nullable(),
  toStatus: z.string().nullable(),
})

export type IntakeOrderHistoryEntry = z.infer<typeof IntakeOrderHistoryEntrySchema>

export const IntakeOrderHistoryResponseSchema = z.array(IntakeOrderHistoryEntrySchema)

export const IntakeOrderChangeStatusInputSchema = z.object({
  status: z.enum(intakeOrderStatusValues),
})

export type IntakeOrderChangeStatusInput = z.infer<typeof IntakeOrderChangeStatusInputSchema>

/**
 * The three ways the list can be read: the shop's live signed work, the drafts still being
 * filled in, or what the office removed. `unfinished` and `deleted` are mutually exclusive —
 * a draft is hard-deleted, so a removed order is always a signed one — which a pair of
 * independent checkboxes cannot express but one view can (docs/25 V-6-1a).
 */
export const intakeOrderListViewValues = ['active', 'unfinished', 'deleted'] as const

export type IntakeOrderListView = (typeof intakeOrderListViewValues)[number]

/**
 * `view` is only meaningful for a full-view actor: the office's table is a work list
 * of real intakes, so drafts and removed orders are excluded unless asked for. A caller
 * limited to `view_own` always sees their own rows including drafts — it is their own
 * unfinished work, and hiding it would mean they could not resume from the list. `deleted`
 * additionally requires `intake_orders.delete` (enforced by the service, not this schema).
 */
export const IntakeOrderListQuerySchema = z.object({
  status: z.enum(intakeOrderStatusValues).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  view: z.enum(intakeOrderListViewValues).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
    .default(25),
})

export type IntakeOrderListQuery = z.infer<typeof IntakeOrderListQuerySchema>

/**
 * The list screen's URL search params. Kept separate from `IntakeOrderListQuerySchema`:
 * the API's version coerces strings off the wire, while this one validates an already-typed
 * router search object and leaves every filter optional so a bare `/prijem` is valid.
 */
export const IntakeOrdersSearchSchema = z.object({
  status: z.enum(intakeOrderStatusValues).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  view: z.enum(intakeOrderListViewValues).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).optional(),
})

export type IntakeOrdersSearch = z.infer<typeof IntakeOrdersSearchSchema>

export const IntakeNumberCheckQuerySchema = z.object({
  number: orderNumberSchema,
})

export type IntakeNumberCheckQuery = z.infer<typeof IntakeNumberCheckQuerySchema>

export const IntakePlateLookupQuerySchema = z.object({
  plate: plateSchema,
})

export type IntakePlateLookupQuery = z.infer<typeof IntakePlateLookupQuerySchema>

export const IntakeOrderListItemSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  status: z.enum(intakeOrderStatusValues),
  receivedAt: z.string(),
  vehicleType: z.enum(intakeVehicleTypeValues),
  plate: z.string(),
  vehicle: z.string(),
  ownerName: z.string(),
  technicianName: z.string(),
  damageCount: z.number().int().nonnegative(),
  photoCount: z.number().int().nonnegative(),
  /** NULL while the intake is still being filled in — the row renders as "Nedovršen". */
  signedAt: z.string().nullable(),
  /** 1–5 while unfinished, so the list can say where it stopped. */
  draftStep: z.number().int().nullable(),
  /** Set once the intake condition was corrected after signing. */
  amendedAt: z.string().nullable(),
  /** How many of the tablet's photos never arrived; 0 when everything is in. */
  photosPending: z.number().int().nonnegative(),
})

export type IntakeOrderListItem = z.infer<typeof IntakeOrderListItemSchema>

export const IntakeOrderPhotoSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  thumbnailPath: z.string().nullable(),
  caption: z.string().nullable(),
  /** The damage this photo belongs to, or null for a general whole-vehicle shot. */
  damageId: z.string().nullable(),
  uploadedAt: z.string(),
})

export type IntakeOrderPhoto = z.infer<typeof IntakeOrderPhotoSchema>

/**
 * One aggregate detail fetch, as the claims rule requires — photos come with the order
 * rather than in a second round trip.
 */
export const IntakeOrderDetailSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  status: z.enum(intakeOrderStatusValues),
  receivedAt: z.string(),
  technicianId: z.string().uuid(),
  technicianName: z.string(),
  vehicleType: z.enum(intakeVehicleTypeValues),
  plate: z.string(),
  vehicle: z.string(),
  vin: z.string().nullable(),
  mileage: z.number().int().nullable(),
  arrivalMode: z.enum(intakeArrivalModeValues),
  ownerName: z.string(),
  ownerAddress: z.string().nullable(),
  ownerPhone: z.string(),
  ownerRemarks: z.string().nullable(),
  fuelLevel: z.number().int(),
  checklist: IntakeChecklistSchema,
  equipmentNote: z.string().nullable(),
  damages: IntakeDamagesSchema,
  services: z.array(z.string()),
  materials: z.array(z.string()),
  draftStep: z.number().int().nullable(),
  technicianSignature: z.string().nullable(),
  ownerSignature: z.string().nullable(),
  signedAt: z.string().nullable(),
  amendedAt: z.string().nullable(),
  amendedByName: z.string().nullable(),
  /**
   * NULL for a live order. Present so the detail can tell a removed order from a live one —
   * without it the screen would have to infer the state from which list the user arrived
   * through, and would draw the action row on an order that is off the list.
   */
  deletedAt: z.string().nullable(),
  photosPending: z.number().int().nonnegative(),
  photos: z.array(IntakeOrderPhotoSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type IntakeOrderDetail = z.infer<typeof IntakeOrderDetailSchema>

export const IntakeOrderListResponseSchema = z.object({
  items: z.array(IntakeOrderListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

export type IntakeOrderListResponse = z.infer<typeof IntakeOrderListResponseSchema>

/** The four KPI cards above the list. Counts signed orders only — a half-entered intake nobody handed over must not inflate "Primljeno". */
export const IntakeOrderSummarySchema = z.object({
  primljeno: z.number().int().nonnegative(),
  uRadu: z.number().int().nonnegative(),
  gotovo: z.number().int().nonnegative(),
  preuzeto: z.number().int().nonnegative(),
})

export type IntakeOrderSummary = z.infer<typeof IntakeOrderSummarySchema>

export const IntakeNumberCheckStatus = {
  Free: 'free',
  TakenOrder: 'taken_order',
  TakenDraftMine: 'taken_draft_mine',
  TakenDraftOther: 'taken_draft_other',
} as const

export type IntakeNumberCheckStatus =
  (typeof IntakeNumberCheckStatus)[keyof typeof IntakeNumberCheckStatus]

export const intakeNumberCheckStatusValues = [
  IntakeNumberCheckStatus.Free,
  IntakeNumberCheckStatus.TakenOrder,
  IntakeNumberCheckStatus.TakenDraftMine,
  IntakeNumberCheckStatus.TakenDraftOther,
] as const

/**
 * `orderId` is returned only when the caller may open that order — their own draft, or a
 * signed order they can see. A colleague's unfinished intake yields the colleague's name
 * (this is an internal app, and naming them is how the collision actually gets resolved)
 * but never an id, because they cannot open it.
 */
export const IntakeNumberCheckResponseSchema = z.object({
  status: z.enum(intakeNumberCheckStatusValues),
  orderId: z.string().uuid().nullable(),
  draftStep: z.number().int().nullable(),
  takenByName: z.string().nullable(),
  vehicle: z.string().nullable(),
  plate: z.string().nullable(),
})

export type IntakeNumberCheckResponse = z.infer<typeof IntakeNumberCheckResponseSchema>

/** Prefill offered when a plate has been through the shop before. `null` = never seen. */
export const IntakePlateLookupResponseSchema = z.object({
  match: z
    .object({
      orderId: z.string().uuid(),
      orderNumber: z.string(),
      receivedAt: z.string(),
      vehicleType: z.enum(intakeVehicleTypeValues),
      vehicle: z.string(),
      vin: z.string().nullable(),
      ownerName: z.string(),
      ownerAddress: z.string().nullable(),
      ownerPhone: z.string(),
    })
    .nullable(),
})

export type IntakePlateLookupResponse = z.infer<typeof IntakePlateLookupResponseSchema>

export const IntakeDetailTab = {
  Pregled: 'pregled',
  Fotografije: 'fotografije',
  Spec: 'spec',
  Istorija: 'istorija',
} as const

export type IntakeDetailTab = (typeof IntakeDetailTab)[keyof typeof IntakeDetailTab]

export const intakeDetailTabValues = [
  IntakeDetailTab.Pregled,
  IntakeDetailTab.Fotografije,
  IntakeDetailTab.Spec,
  IntakeDetailTab.Istorija,
] as const

/**
 * Optional, and it falls back rather than throwing. A required `tab` would force every one of
 * the three existing links to `/prijem/$id` to carry one (TanStack derives a link's search
 * requirements from the validator's OUTPUT type), and a stale `?tab=` from a shared link would
 * drop the reader on the error component instead of the order.
 */
export const IntakeDetailSearchSchema = z.object({
  tab: z.enum(intakeDetailTabValues).optional().catch(undefined),
})

export type IntakeDetailSearch = z.infer<typeof IntakeDetailSearchSchema>

/**
 * `/prijem/novi?resume=<id>` — the typeable second entrance into an unfinished intake, which the
 * server has expected since V-6-0. Optional and forgiving for the same reason `tab` is: the wizard
 * is reached from a plain link in three places, and a stale id out of someone's history must open
 * an empty intake rather than an error screen.
 */
export const IntakeWizardSearchSchema = z.object({
  resume: z.string().uuid().optional().catch(undefined),
})

export type IntakeWizardSearch = z.infer<typeof IntakeWizardSearchSchema>
