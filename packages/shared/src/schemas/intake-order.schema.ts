import { z } from 'zod'

import { intakeDamageTypeValues } from '../enums.js'

/**
 * A checklist item's code: the catalog's stable identity, and literally a jsonb key on every order
 * that recorded it. It lives HERE, in the file `@mr/db` imports, because both halves need the same
 * alphabet — the catalog's create form and the order's checklist map. Two copies of this rule is
 * how an admin ends up able to create an item the order schema then refuses to store.
 */
export const INTAKE_CHECKLIST_CODE_MAX = 40

export const IntakeChecklistCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(INTAKE_CHECKLIST_CODE_MAX)
  // Readable in a diff and safe as a jsonb key.
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)

/**
 * A ceiling, not a rule: this map goes into a jsonb column, so an uncapped one is a caller writing
 * as much as it likes into a row. Far above any equipment list a shop would keep.
 */
export const INTAKE_CHECKLIST_MAX_ITEMS = 200

/**
 * The equipment checklist an order records — `{code: DA/NE/untouched}`, keyed by the codes the
 * `intake_checklist_items` catalog holds.
 *
 * The WIRE deliberately does not judge WHICH codes are allowed; the service does, against the
 * catalog (spec ⑭). It cannot: the shop adds and retires items at runtime, so a schema naming the
 * codes would either 422 a wizard patch carrying a newly added item or silently strip it — and a
 * stripped row is a line missing from a document a customer signed.
 *
 * `null` is a value, not an absence: nobody touched that row. An untouched row prints `—`, while a
 * row missing from the map prints as nothing at all and the sheet quietly loses a line.
 */
export const IntakeChecklistSchema = z
  .record(IntakeChecklistCodeSchema, z.boolean().nullable())
  // A `refine`, because zod 4's `ZodRecord` has no `.max()` — only `ZodMap` and `ZodSet` do.
  .refine((checklist) => Object.keys(checklist).length <= INTAKE_CHECKLIST_MAX_ITEMS, {
    message: `A checklist carries at most ${INTAKE_CHECKLIST_MAX_ITEMS} items`,
  })

export type IntakeChecklist = z.infer<typeof IntakeChecklistSchema>

/** The damage map's coordinate space — the silhouette's own viewBox, never screen pixels. */
export const INTAKE_DAMAGE_MAP_WIDTH = 340
export const INTAKE_DAMAGE_MAP_HEIGHT = 556

/**
 * One marker on the damage map. Coordinates live in the drawing's space so a
 * marker sits in the same place on tablet, desktop and paper. `id` is stable so
 * a photo can point at this damage even after the list is reordered; `zone` is
 * the human name derived from (vehicleType, x, y) at marking time and is what
 * gets printed.
 */
export const IntakeDamageSchema = z.object({
  id: z.string().trim().min(1).max(40),
  type: z.enum(intakeDamageTypeValues),
  x: z.number().min(0).max(INTAKE_DAMAGE_MAP_WIDTH),
  y: z.number().min(0).max(INTAKE_DAMAGE_MAP_HEIGHT),
  zone: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
})

export type IntakeDamage = z.infer<typeof IntakeDamageSchema>

/** Array order IS the ①②③ numbering shown on the map, in the list and on the print. */
export const IntakeDamagesSchema = z.array(IntakeDamageSchema)
