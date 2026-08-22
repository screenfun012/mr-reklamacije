import { m } from '@mr/i18n'
import { ClaimSortBy, ClaimSortDir, type ClaimsSearch } from '@mr/shared'
import { FilterSelect } from '@mr/ui'
import type { ReactElement } from 'react'

import { INTERNAL_CONTROL_CLASSES } from '~/components/internal-field'

/**
 * Sorting for the card layout. The table sorts from its column headers, and a card list has no
 * header — without this, the two sortable columns would simply be unreachable on a phone.
 *
 * The value pairs the column with the direction because that is what one control can express;
 * the server's own default (date received, newest first) is what an untouched list shows, so
 * that is what this reads when the URL carries no sort.
 */
const SEPARATOR = ':'

function optionValue(sortBy: string, sortDir: string): string {
  return `${sortBy}${SEPARATOR}${sortDir}`
}

export function ClaimsSortSelect({
  search,
  onSearchChange,
}: {
  search: ClaimsSearch
  onSearchChange: (next: ClaimsSearch) => void
}): ReactElement {
  const options = [
    {
      value: optionValue(ClaimSortBy.DateOfClaim, ClaimSortDir.Desc),
      label: m.claims_sort_received_desc(),
    },
    {
      value: optionValue(ClaimSortBy.DateOfClaim, ClaimSortDir.Asc),
      label: m.claims_sort_received_asc(),
    },
    {
      value: optionValue(ClaimSortBy.DateOfFinish, ClaimSortDir.Desc),
      label: m.claims_sort_finish_desc(),
    },
    {
      value: optionValue(ClaimSortBy.DateOfFinish, ClaimSortDir.Asc),
      label: m.claims_sort_finish_asc(),
    },
  ]

  const value = optionValue(
    search.sortBy ?? ClaimSortBy.DateOfClaim,
    search.sortDir ?? ClaimSortDir.Desc,
  )

  return (
    <FilterSelect
      value={value}
      options={options}
      placeholder={m.claims_sort_label()}
      aria-label={m.claims_sort_label()}
      className={INTERNAL_CONTROL_CLASSES}
      onValueChange={(next) => {
        const [sortBy, sortDir] = next.split(SEPARATOR)
        if (sortBy === undefined || sortDir === undefined) {
          return
        }
        onSearchChange({
          ...search,
          sortBy: sortBy as ClaimsSearch['sortBy'],
          sortDir: sortDir as ClaimsSearch['sortDir'],
          page: 1,
        })
      }}
    />
  )
}
