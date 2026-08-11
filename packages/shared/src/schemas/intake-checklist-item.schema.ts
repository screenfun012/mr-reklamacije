import { z } from 'zod'

/**
 * The code is what an intake order STORES (`checklist` is a `{code: DA/NE}` map), so it is the
 * stable identity and it is never edited after creation — changing it would orphan every order that
 * used it (spec ⑫/⑬). Names are editable and the rename is retroactive by design.
 */
export const INTAKE_CHECKLIST_CODE_MAX = 40
export const INTAKE_CHECKLIST_NAME_MAX = 80

export const IntakeChecklistItemCreateInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(INTAKE_CHECKLIST_CODE_MAX)
    // Same alphabet the seeded codes use, so a code is safe as a jsonb key and readable in a diff.
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  nameSr: z.string().trim().min(1).max(INTAKE_CHECKLIST_NAME_MAX),
  // Required, not optional: the work order prints in both languages (V-7 ⑪), so an item without an
  // English name prints Serbian on the English sheet.
  nameEn: z.string().trim().min(1).max(INTAKE_CHECKLIST_NAME_MAX),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
})

export const IntakeChecklistItemUpdateInputSchema = IntakeChecklistItemCreateInputSchema.omit({
  code: true,
})
  .partial()
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
