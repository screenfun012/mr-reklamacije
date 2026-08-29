import { pendingClientSubmissionsListOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { InternalButton } from '~/components/internal-button'

import { InboxTable } from './inbox-table'

export interface InboxListProps {
  page: number
  onPageChange: (page: number) => void
}

/** Data-fetching Inbox list: pending submissions + minimal page navigation. */
export function InboxList({ page, onPageChange }: InboxListProps): React.ReactElement {
  const { data } = useSuspenseQuery(pendingClientSubmissionsListOptions(page))
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <div className="flex flex-col gap-6">
      <InboxTable items={data.items} total={data.total} />

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-3 border-t border-mri-border pt-4">
          <span className="font-mono text-[11px] tabular-nums text-mri-text2">
            {m.emotive_claims_pagination_page_of({ page: data.page, totalPages })}
          </span>
          <div className="flex items-center gap-1.5">
            <InternalButton
              type="button"
              variant="outline"
              className="relative size-9 w-9 p-0 after:absolute after:-inset-0.5"
              disabled={data.page <= 1}
              aria-label={m.emotive_claims_pagination_previous()}
              onClick={() => onPageChange(data.page - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </InternalButton>
            <InternalButton
              type="button"
              variant="outline"
              className="relative size-9 w-9 p-0 after:absolute after:-inset-0.5"
              disabled={data.page >= totalPages}
              aria-label={m.emotive_claims_pagination_next()}
              onClick={() => onPageChange(data.page + 1)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </InternalButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
