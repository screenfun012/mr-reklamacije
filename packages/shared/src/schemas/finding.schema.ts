import { z } from 'zod'

/**
 * One inspection finding on a claim: free text plus a free-form type tag
 * (the tag is an operator-typed label, not a fixed catalog). Stored as an
 * ordered jsonb array on the claim, replacing the single `internal_notes` field.
 */
export const FindingSchema = z.object({
  text: z.string().trim().min(1),
  type: z.string().trim().max(80).default(''),
})

export type Finding = z.infer<typeof FindingSchema>

export const FindingsSchema = z.array(FindingSchema)
