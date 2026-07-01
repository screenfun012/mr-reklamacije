import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MAX_PAGES_WITHOUT_WINDOW = 7

type PageToken = number | 'ellipsis'

// Windowed page list: 1 … (current-1) current (current+1) … total.
function buildPageWindow(current: number, total: number): PageToken[] {
  if (total <= MAX_PAGES_WITHOUT_WINDOW) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const wanted = [1, current - 1, current, current + 1, total].filter(
    (page) => page >= 1 && page <= total,
  )
  const unique = [...new Set(wanted)].sort((a, b) => a - b)

  const tokens: PageToken[] = []
  let previous = 0
  for (const page of unique) {
    if (previous !== 0 && page - previous > 1) {
      tokens.push('ellipsis')
    }
    tokens.push(page)
    previous = page
  }
  return tokens
}

export interface ClientClaimsPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function ClientClaimsPagination({
  page,
  totalPages,
  onPageChange,
}: ClientClaimsPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const tokens = buildPageWindow(page, totalPages)

  return (
    <nav
      className="flex items-center justify-center gap-2 pt-2"
      aria-label={m.portal_pagination_page_of({ page, totalPages })}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{m.portal_pagination_previous()}</span>
      </Button>

      <div className="flex items-center gap-1">
        {tokens.map((token, index) =>
          token === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-mr-text-tertiary"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={token}
              type="button"
              variant={token === page ? 'default' : 'ghost'}
              size="icon"
              className="size-9"
              aria-current={token === page ? 'page' : undefined}
              onClick={() => onPageChange(token)}
            >
              {token}
            </Button>
          ),
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <span className="hidden sm:inline">{m.portal_pagination_next()}</span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  )
}
