import { m } from '@mr/i18n'
import { formatListDate, type ClaimCategoryRef } from '@mr/shared'

/**
 * `KATEGORIJA UGAŠENA 03/26` beside the MR number (prototype, detail header). A claim keeps the
 * kind of work it was entered under even after the office switches it off — the header has to say
 * so, with the date, rather than show it as if nothing happened.
 */
export function ClaimCategoryRetiredBadge({
  category,
}: {
  category: ClaimCategoryRef | null
}): React.ReactElement | null {
  if (category === null || category.isActive) {
    return null
  }

  // A type check, not `!== null`: a payload missing the field entirely would otherwise reach
  // `formatListDate` as undefined and take the whole detail header down over a date.
  const since =
    typeof category.deactivatedAt === 'string' ? ` ${formatListDate(category.deactivatedAt)}` : ''

  return (
    <span className="rounded-md border border-dashed border-mri-border2 bg-mri-inbg px-[9px] py-1 font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-mri-text2">
      {m.claim_category_retired_badge()}
      {since}
    </span>
  )
}
