import { z } from 'zod'

import { IntakeChecklistCodeSchema } from './intake-order.schema.js'
import { ReferenceListQuerySchema } from './reference-data.schema.js'

/**
 * The catalog's own list query: the seven other catalogs need only `activeOnly`, this one also has a
 * DISPLAY reader. `activeOnly: true` is the wizard's picker, `activeOnly: false` is the admin screen,
 * and `includeDeleted: true` is the detail card and the printed sheet — an order stores CODES, so a
 * code whose item the shop has since removed must still resolve to a name instead of printing bare
 * on a document a customer signed (plan D3). Defaults to false: only the display path opts in, and
 * absent means "live rows only" the way every other repo read in this codebase does.
 */
export const IntakeChecklistItemsListQuerySchema = ReferenceListQuerySchema.extend({
  includeDeleted: z
    .string()
    .optional()
    .transform((value: string | undefined) => value === 'true'),
})

export type IntakeChecklistItemsListQuery = z.infer<typeof IntakeChecklistItemsListQuerySchema>

/**
 * The code is what an intake order STORES (`checklist` is a `{code: DA/NE}` map), so it is the
 * stable identity and it is never edited after creation — changing it would orphan every order that
 * used it (spec ⑫/⑬). Names are editable and the rename is retroactive by design.
 *
 * Its shape comes from `IntakeChecklistCodeSchema`, shared with the order's checklist map on
 * purpose: a code this form accepts must be a code that map can carry, and two copies of the rule
 * would eventually disagree.
 */
export const INTAKE_CHECKLIST_NAME_MAX = 80

export const IntakeChecklistItemCreateInputSchema = z.object({
  code: IntakeChecklistCodeSchema,
  nameSr: z.string().trim().min(1).max(INTAKE_CHECKLIST_NAME_MAX),
  // Required, not optional: the work order prints in both languages (V-7 ⑪), so an item without an
  // English name prints Serbian on the English sheet.
  nameEn: z.string().trim().min(1).max(INTAKE_CHECKLIST_NAME_MAX),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
})

/**
 * `.strict()`, not the default strip: a body carrying `code` is an attempt to change the code, and
 * quietly dropping it would answer 200 while the code stayed put — the admin would be told an edit
 * worked when nothing happened. Refuse loudly instead.
 */
export const IntakeChecklistItemUpdateInputSchema = IntakeChecklistItemCreateInputSchema.omit({
  code: true,
})
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export const IntakeChecklistItemListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  nameSr: z.string(),
  nameEn: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
})

export type IntakeChecklistItemCreateInput = z.infer<typeof IntakeChecklistItemCreateInputSchema>
export type IntakeChecklistItemUpdateInput = z.infer<typeof IntakeChecklistItemUpdateInputSchema>
export type IntakeChecklistItemListItem = z.infer<typeof IntakeChecklistItemListItemSchema>
