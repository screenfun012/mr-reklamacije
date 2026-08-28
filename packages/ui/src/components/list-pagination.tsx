import { m } from '@mr/i18n'
import { isListPageSize, LIST_PAGE_SIZE_OPTIONS, type ListPageSize } from '@mr/shared'
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '../primitives/button.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select.js'

/**
 * 30px, radius 8 — the prototype's pager (§4). The halo stretches the target to 40px tall
 * without touching a visible pixel; sideways it stays at 30 so neighbours' targets never overlap.
 */
const PAGER_BUTTON_CLASSES =
  'relative size-[30px] rounded-lg after:absolute after:inset-x-0 after:-inset-y-[5px]'

export interface ListPaginationProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: ListPageSize) => void
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

export function ListPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ListPaginationProps) {
  const { from, to, totalPages } = paginationRange(total, page, pageSize)
  const isFirstPage = page <= 1
  const isLastPage = page >= totalPages

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm tabular-nums text-muted-foreground">
        {m.list_pagination_showing({ from, to, total })}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{m.emotive_claims_pagination_per_page()}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              const next = Number(value)
              if (isListPageSize(next)) {
                onPageSizeChange(next)
              }
            }}
          >
            <SelectTrigger
              className="h-8 w-[4.5rem]"
              aria-label={m.emotive_claims_pagination_per_page()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mono, uppercase — a page number is technical, and every technical value in these
            screens is written in the same hand (prototype §0/§4). */}
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] tabular-nums text-muted-foreground">
          {m.emotive_claims_pagination_page_of({ page, totalPages })}
        </p>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={PAGER_BUTTON_CLASSES}
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
            className={PAGER_BUTTON_CLASSES}
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
            className={PAGER_BUTTON_CLASSES}
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
            className={PAGER_BUTTON_CLASSES}
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
