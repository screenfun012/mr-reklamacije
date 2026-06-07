import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

export interface EmotiveClaimsPaginationProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: (typeof PAGE_SIZE_OPTIONS)[number]) => void
}

function paginationRange(
  total: number,
  page: number,
  pageSize: number,
): { from: number; to: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) {
    return { from: 0, to: 0, totalPages }
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return { from, to, totalPages }
}

export function EmotiveClaimsPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: EmotiveClaimsPaginationProps) {
  const { from, to, totalPages } = paginationRange(total, page, pageSize)
  const isFirstPage = page <= 1
  const isLastPage = page >= totalPages

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {m.emotive_claims_pagination_showing({ from, to, total })}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{m.emotive_claims_pagination_per_page()}</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={pageSize}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (next === 10 || next === 25 || next === 50) {
                onPageSizeChange(next)
              }
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm text-muted-foreground">
          {m.emotive_claims_pagination_page_of({ page, totalPages })}
        </p>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={isFirstPage}
            aria-label={m.emotive_claims_pagination_first()}
            onClick={() => onPageChange(1)}
          >
            <ChevronFirst className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={isFirstPage}
            aria-label={m.emotive_claims_pagination_previous()}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={isLastPage || total === 0}
            aria-label={m.emotive_claims_pagination_next()}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={isLastPage || total === 0}
            aria-label={m.emotive_claims_pagination_last()}
            onClick={() => onPageChange(totalPages)}
          >
            <ChevronLast className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
