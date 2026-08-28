import { m } from '@mr/i18n'
import { cn } from '@mr/ui'

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

// The halo stretches the 36px look to a 40px target without moving a visible pixel.
const PAGE_BUTTON =
  'relative grid size-9 cursor-pointer place-items-center rounded-lg border font-mono text-[12px] font-semibold transition-[color,border-color,background-color,transform] after:absolute after:-inset-0.5 active:scale-[0.94]'

export function PortalPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) {
    return null
  }

  const tokens = buildPageWindow(page, totalPages)

  return (
    <nav
      className="mt-6 flex items-center justify-center gap-1.5"
      aria-label={m.portal_pagination_page_of({ page, totalPages })}
    >
      <button
        type="button"
        aria-label={m.portal_pagination_previous()}
        className={cn(
          PAGE_BUTTON,
          'border-mrp-border2 bg-transparent text-mrp-text2 hover:text-mrp-text disabled:cursor-not-allowed disabled:opacity-40',
        )}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ←
      </button>
      {tokens.map((token, index) =>
        token === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-1.5 text-mrp-text2" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={token}
            type="button"
            aria-current={token === page ? 'page' : undefined}
            className={cn(
              PAGE_BUTTON,
              token === page
                ? 'border-transparent bg-mrp-red text-white'
                : 'border-mrp-border2 bg-transparent text-mrp-text2 hover:text-mrp-text',
            )}
            onClick={() => onPageChange(token)}
          >
            {token}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label={m.portal_pagination_next()}
        className={cn(
          PAGE_BUTTON,
          'border-mrp-border2 bg-transparent text-mrp-text2 hover:text-mrp-text disabled:cursor-not-allowed disabled:opacity-40',
        )}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        →
      </button>
    </nav>
  )
}
