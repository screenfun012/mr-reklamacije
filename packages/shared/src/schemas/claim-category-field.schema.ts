import { z } from 'zod'

import { ReferenceListQuerySchema } from './reference-data.schema.js'

const boolQueryParam = z
  .string()
  .optional()
  .transform((value: string | undefined) => value === 'true')

/**
 * `select` is answered from the field's own options; `text` is typed. How a `select` is DRAWN —
 * buttons in a row or a dropdown — follows from how many options it has, so it is not a third
 * type here: one less thing for the office to have to choose correctly.
 */
export const CLAIM_CATEGORY_FIELD_TYPES = ['select', 'text'] as const

export type ClaimCategoryFieldType = (typeof CLAIM_CATEGORY_FIELD_TYPES)[number]

/** Up to this many options a select is drawn as a row of buttons (prototype: Glava/Blok/Radilica). */
export const CLAIM_CATEGORY_FIELD_SEGMENTED_MAX_OPTIONS = 3

/** A typed answer's ceiling — a category field is a label on a part, never a paragraph. */
export const CLAIM_CATEGORY_FIELD_TEXT_MAX_LENGTH = 200

/**
 * A code is what the jsonb on the claim is keyed by, so it is fixed once created — the same rule
 * a category's code follows. Lowercase, digits and underscore only: it travels through SQL
 * (`category_field_values ->> 'obradjeni_deo'`) and has to read plainly there too.
 */
const CodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9_]+$/, 'Code may contain only a-z, 0-9 and _')

export const ClaimCategoryFieldOptionListItemSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  deactivatedAt: z.string().nullable(),
  createdAt: z.string(),
  usageCount: z.number().int().nonnegative(),
})

export type ClaimCategoryFieldOptionListItem = z.infer<
  typeof ClaimCategoryFieldOptionListItemSchema
>

export const ClaimCategoryFieldListItemSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  code: z.string(),
  name: z.string(),
  fieldType: z.enum(CLAIM_CATEGORY_FIELD_TYPES),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  deactivatedAt: z.string().nullable(),
  createdAt: z.string(),
  usageCount: z.number().int().nonnegative(),
  /**
   * Present only when the list was asked for `includeOptions=true`; then it holds ALL options,
   * retired ones included — the detail of an old claim has to name a value nobody offers anymore.
   */
  options: z.array(ClaimCategoryFieldOptionListItemSchema).optional(),
})

export type ClaimCategoryFieldListItem = z.infer<typeof ClaimCategoryFieldListItemSchema>

export const ClaimCategoryFieldCreateInputSchema = z.object({
  categoryId: z.string().uuid(),
  code: CodeSchema,
  name: z.string().trim().min(1).max(200),
  fieldType: z.enum(CLAIM_CATEGORY_FIELD_TYPES).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export type ClaimCategoryFieldCreateInput = z.infer<typeof ClaimCategoryFieldCreateInputSchema>

export const ClaimCategoryFieldUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    // The TYPE is deliberately absent: answers are already stored against it, and switching a
    // select to text would leave option codes standing in for typed words.
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type ClaimCategoryFieldUpdateInput = z.infer<typeof ClaimCategoryFieldUpdateInputSchema>

export const ClaimCategoryFieldOptionCreateInputSchema = z.object({
  fieldId: z.string().uuid(),
  code: CodeSchema,
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
})

export type ClaimCategoryFieldOptionCreateInput = z.infer<
  typeof ClaimCategoryFieldOptionCreateInputSchema
>

export const ClaimCategoryFieldOptionUpdateInputSchema = ClaimCategoryFieldUpdateInputSchema

export type ClaimCategoryFieldOptionUpdateInput = z.infer<
  typeof ClaimCategoryFieldOptionUpdateInputSchema
>

export const ClaimCategoryFieldsListQuerySchema = ReferenceListQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  includeOptions: boolQueryParam,
})

export type ClaimCategoryFieldsListQuery = z.infer<typeof ClaimCategoryFieldsListQuerySchema>

export const ClaimCategoryFieldOptionsListQuerySchema = ReferenceListQuerySchema.extend({
  fieldId: z.string().uuid().optional(),
})

export type ClaimCategoryFieldOptionsListQuery = z.infer<
  typeof ClaimCategoryFieldOptionsListQuerySchema
>

/**
 * `{ "<field code>": "<option code or typed text>" }` for ONE category. This is what crosses the
 * wire in both directions — the nesting by category id is storage, and stays on the server so no
 * screen ever handles an id (V2 spec §4.6).
 *
 * Zod bounds the SHAPE; which codes are real and still alive is the service's job against the
 * catalogue (`core/claims/validate-category-field-values.ts`) — a schema cannot know that.
 */
export const ClaimCategoryFieldValuesSchema = z
  .record(CodeSchema, z.string().trim().min(1).max(CLAIM_CATEGORY_FIELD_TEXT_MAX_LENGTH))
  .refine((values) => Object.keys(values).length <= 50, {
    message: 'Too many category field values',
  })

export type ClaimCategoryFieldValues = z.infer<typeof ClaimCategoryFieldValuesSchema>

/**
 * What a claim carried under a kind of work it has since been moved away from. Read-only, named
 * in words only — the claim keeps it so nothing typed is ever lost by a corrected mistake.
 */
export const ClaimPreviousCategoryFieldValuesSchema = z.object({
  categoryCode: z.string(),
  categoryName: z.string(),
  values: z.array(
    z.object({
      fieldCode: z.string(),
      fieldName: z.string(),
      /** The option's name for a select, the typed words for a text field. */
      display: z.string(),
    }),
  ),
})

export type ClaimPreviousCategoryFieldValues = z.infer<
  typeof ClaimPreviousCategoryFieldValuesSchema
>
