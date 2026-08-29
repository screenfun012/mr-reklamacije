import { m } from '@mr/i18n'
import { Link } from '@tanstack/react-router'
import { Package, Plus } from 'lucide-react'

import { internalButtonClasses } from '~/components/internal-button'

/**
 * Two different silences, said differently (prototype: `emptyCat` / `emptyFilter`). A category
 * with nothing in it invites the first claim; a filter with no hit says to check the filter.
 * Telling them apart is the whole reason both exist.
 */
export function ClaimsCategoryEmpty({
  categoryCode,
  canCreate,
}: {
  categoryCode?: string | undefined
  canCreate: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-mri-border bg-mri-surface px-5 py-[52px] text-center">
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-xl border border-mri-border2 bg-mri-inbg text-mri-text2"
      >
        <Package className="size-5" />
      </span>
      <span className="text-balance text-[15px] font-extrabold text-mri-text">
        {m.claims_empty_category_title()}
      </span>
      <span className="text-pretty text-[12.5px] italic text-mri-text2">
        {m.claims_empty_category_hint()}
      </span>
      {/* The invitation is a door, not a sentence: an empty category is the one screen where the
          next thing to do is obvious (prototype §4). */}
      {canCreate ? (
        <Link
          to="/reklamacije/nova"
          search={categoryCode === undefined ? {} : { categoryCode }}
          className={internalButtonClasses('primary', 'mt-1 h-[38px] w-auto px-[18px] text-xs')}
        >
          <Plus className="size-4" aria-hidden="true" />
          {m.crumb_new_claim()}
        </Link>
      ) : null}
    </div>
  )
}

export function ClaimsFilterEmpty({ onClear }: { onClear: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-[14px] border border-mri-border bg-mri-surface px-5 py-11 text-center">
      <span className="text-balance text-[14.5px] font-extrabold text-mri-text">
        {m.claims_empty_filter_title()}
      </span>
      <span className="text-pretty text-[12.5px] italic text-mri-text2">
        {m.claims_empty_filter_hint()}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="relative cursor-pointer py-2 text-xs font-bold uppercase tracking-[0.06em] text-mri-redh after:absolute after:inset-x-0 after:-inset-y-1 hover:underline"
      >
        {m.claims_empty_filter_clear()}
      </button>
    </div>
  )
}
