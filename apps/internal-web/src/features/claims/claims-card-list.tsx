import { m } from '@mr/i18n'
import { formatListDate, type ClaimListItem } from '@mr/shared'
import { cn, dataTableIconActionClassName, dataTableRowNavigableClassName } from '@mr/ui'
import { useNavigate } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'

import { KindPill } from '~/components/kind-pill'
import { OutcomePill } from '~/components/outcome-pill'
import { claimDetailTarget } from '~/features/command-palette/claim-target'

import { ClaimCategoryChip } from './claim-category-chip'
import { ClaimsSelectionCheckbox } from './claims-selection-checkbox'

export interface ClaimsCardListProps {
  rows: readonly Row<ClaimListItem>[]
  /** False inside one category, where every card would repeat the same word — as the column does. */
  showCategory: boolean
  categoryCode: string | undefined
  canDelete: (item: ClaimListItem) => boolean
  onDeleteRequest: (item: ClaimListItem) => void
}

/**
 * The same list, arranged for a box too narrow for the table. Six of the thirteen columns
 * survive — the ones a row is recognised by; the rest is detail the claim itself carries.
 *
 * The values are the row's own (`row.original`), so the two layouts can only differ in
 * arrangement, never in data. Which one shows is decided by CSS in the table's container
 * query, not by a width hook: a hook disagrees between the server render and the browser's.
 */
export function ClaimsCardList({
  rows,
  showCategory,
  categoryCode,
  canDelete,
  onDeleteRequest,
}: ClaimsCardListProps): ReactElement {
  const navigate = useNavigate()

  return (
    <ul>
      {rows.map((row) => {
        const item = row.original
        const detailLink = claimDetailTarget(item, categoryCode)

        return (
          <li
            key={row.id}
            className={cn(
              dataTableRowNavigableClassName,
              'flex flex-col gap-1.5 border-b border-mri-border px-4 py-3 last:border-b-0',
            )}
            onClick={() => {
              void navigate(detailLink)
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <ClaimsSelectionCheckbox
                  checked={row.getIsSelected()}
                  onChange={(value) => row.toggleSelected(value)}
                  ariaLabel={m.claims_select_row()}
                />
                <span className="truncate font-mono text-[13.5px] font-semibold text-mri-text">
                  {item.mrNumber ?? '—'}
                </span>
                {item.missingRequiredCategoryFields.length > 0 ? (
                  <span
                    title={m.claim_category_fields_incomplete_hint()}
                    aria-label={m.claim_category_fields_incomplete_hint()}
                    className="size-[6px] flex-none rounded-full bg-mri-amb"
                  />
                ) : null}
                <KindPill kind={item.kind} />
              </span>
              <OutcomePill outcome={item.outcome} />
            </div>

            <div className="truncate text-[13.5px] text-mri-text">{item.customerName ?? '—'}</div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-mri-text2">
              {showCategory ? <ClaimCategoryChip category={item.category} /> : null}
              <span className="font-mono">
                {item.dateOfClaim === null ? '—' : formatListDate(item.dateOfClaim)}
              </span>
              {canDelete(item) ? (
                <button
                  type="button"
                  className={cn(dataTableIconActionClassName, 'ml-auto hover:text-mri-bad')}
                  aria-label={m.action_delete()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteRequest(item)
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
