import { sql } from 'drizzle-orm'

/**
 * How many claims carry a value for a field / for one of its options — what blocks a hard delete
 * and what the admin screen shows in "u upotrebi".
 *
 * ⚠ Both expressions match on the CATEGORY as well as the code. Two categories may each own a
 * field called `obradjeni_deo`, and without that condition one category's usage would count the
 * other's claims — a delete would then be refused for the wrong reason, or allowed for it.
 *
 * Written against the tables' real names because they are used inside `select()` calls on
 * different builders; keep them textually in step with the schema.
 */
export const categoryFieldUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int FROM emotive_claims ec
    WHERE ec.category_id = claim_category_fields.category_id
      AND ec.deleted_at IS NULL
      AND ec.category_field_values ? claim_category_fields.code
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int FROM domace_claims dc
    WHERE dc.category_id = claim_category_fields.category_id
      AND dc.deleted_at IS NULL
      AND dc.category_field_values ? claim_category_fields.code
  ), 0)
)`.mapWith(Number)

export const categoryFieldOptionUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int FROM emotive_claims ec
    WHERE ec.category_id = claim_category_fields.category_id
      AND ec.deleted_at IS NULL
      AND ec.category_field_values ->> claim_category_fields.code = claim_category_field_options.code
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int FROM domace_claims dc
    WHERE dc.category_id = claim_category_fields.category_id
      AND dc.deleted_at IS NULL
      AND dc.category_field_values ->> claim_category_fields.code = claim_category_field_options.code
  ), 0)
)`.mapWith(Number)
