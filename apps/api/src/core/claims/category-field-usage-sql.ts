import { sql } from 'drizzle-orm'

/**
 * How many claims carry a value for a field / for one of its options — what blocks a hard delete
 * and what the admin screen shows in "u upotrebi".
 *
 * ⚠ `category_field_values` is keyed by the CATEGORY the answers were entered under, so the
 * lookup goes one level down: `-> <field's category id> ->> <field code>`. Reading the top level
 * instead would find category ids where it expects field codes, count zero for everything, and
 * let the office delete a field that claims still carry.
 *
 * ⚠ Both expressions look under the FIELD's own category, NOT under the claim's current one — a
 * claim that was moved to another kind of work still carries what it answered here, and deleting
 * the field would orphan it.
 *
 * Written against the tables' real names because they are used inside `select()` calls on
 * different builders; keep them textually in step with the schema.
 */
export const categoryFieldUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int FROM emotive_claims ec
    WHERE ec.deleted_at IS NULL
      AND ec.category_field_values -> claim_category_fields.category_id::text
            ? claim_category_fields.code
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int FROM domace_claims dc
    WHERE dc.deleted_at IS NULL
      AND dc.category_field_values -> claim_category_fields.category_id::text
            ? claim_category_fields.code
  ), 0)
)`.mapWith(Number)

export const categoryFieldOptionUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int FROM emotive_claims ec
    WHERE ec.deleted_at IS NULL
      AND ec.category_field_values -> claim_category_fields.category_id::text
            ->> claim_category_fields.code = claim_category_field_options.code
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int FROM domace_claims dc
    WHERE dc.deleted_at IS NULL
      AND dc.category_field_values -> claim_category_fields.category_id::text
            ->> claim_category_fields.code = claim_category_field_options.code
  ), 0)
)`.mapWith(Number)

/**
 * The live required fields of a claim's own category that it has no answer for — the whole of the
 * "⚠ DOPUNI PODATKE" mark, computed from the catalogue on every read rather than stored, so it
 * can never drift from what the office currently asks for. ONE expression feeds both the list
 * (which only asks whether it is empty) and the detail (which names the fields), so the two can
 * never disagree about whether a claim is missing something.
 *
 * A correlated subquery inside a select that already runs, so opening a claim stays ONE fetch
 * (docs/04). `claims` is a fixed table name or query alias, never a parameter — it is
 * interpolated into SQL, so it must never come from a request.
 */
export function missingRequiredCategoryFieldsSql(
  claims: 'emotive_claims' | 'domace_claims' | 'ec' | 'dc',
) {
  const table = sql.raw(claims)
  return sql<string[]>`COALESCE((
    SELECT array_agg(f.code ORDER BY f.sort_order, f.name)
    FROM claim_category_fields f
    WHERE f.category_id = ${table}.category_id
      AND f.deleted_at IS NULL
      AND f.is_active
      AND f.is_required
      AND COALESCE(
        ${table}.category_field_values -> ${table}.category_id::text ->> f.code,
        ''
      ) = ''
  ), ARRAY[]::text[])`
}
