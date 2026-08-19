import { m } from '@mr/i18n'
import { isListPageSize, LIST_PAGE_SIZE_OPTIONS, type ListPageSize } from '@mr/shared'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactElement } from 'react'

export interface ResourcePaginationProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: ListPageSize) => void
}

const stepClassName =
  'grid size-[34px] cursor-pointer place-items-center rounded-lg border border-mr-border-strong bg-adm-inbg text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40'

/**
 * The catalogue's own pager, in the prototype's shape: a mono range on the left, the page size and
 * two square steps on the right, sitting INSIDE the list card.
 *
 * Not `ListPagination` from `@mr/ui`: internal-web's claims list and intake list use that one, and
 * restyling it here would move two screens in another app that nobody asked to change. The shared
 * page-size helpers are the same, so the two cannot disagree about what a page is.
 */
export function ResourcePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ResourcePaginationProps): ReactElement {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-mono text-[11px] font-medium uppercase text-muted-foreground">
        {m.list_pagination_showing({ from, to, total })}
      </span>

      <div className="ml-auto flex items-center gap-2.5">
        <label className="flex items-center gap-2 font-mono text-[10.5px] font-medium uppercase text-muted-foreground">
          {m.emotive_claims_pagination_per_page()}
          <select
            value={String(pageSize)}
            aria-label={m.emotive_claims_pagination_per_page()}
            className="cursor-pointer rounded-md border border-mr-border-strong bg-adm-inbg px-2 py-1 font-mono text-[10.5px] font-medium text-foreground"
            onChange={(event) => {
              const next = Number(event.target.value)
              if (isListPageSize(next)) {
                onPageSizeChange(next)
              }
            }}
          >
            {LIST_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={String(size)}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={stepClassName}
          disabled={page <= 1}
          aria-label={m.emotive_claims_pagination_previous()}
          title={m.emotive_claims_pagination_previous()}
          onClick={() => {
            onPageChange(page - 1)
          }}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={stepClassName}
          disabled={page >= totalPages}
          aria-label={m.emotive_claims_pagination_next()}
          title={m.emotive_claims_pagination_next()}
          onClick={() => {
            onPageChange(page + 1)
          }}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
