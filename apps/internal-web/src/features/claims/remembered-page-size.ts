import type { ListPageSize } from '@mr/shared'

/** Per-user claims-table page-size preference (personal, not shared). */
export const CLAIMS_PAGE_SIZE_STORAGE_KEY = 'mrr:internal:claims-page-size'

const VALID_PAGE_SIZES: readonly number[] = [10, 25, 50]

/** Reads the remembered page size, or null if unset/invalid/unavailable (SSR). */
export function readRememberedPageSize(): ListPageSize | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.localStorage.getItem(CLAIMS_PAGE_SIZE_STORAGE_KEY)
  if (raw === null) {
    return null
  }
  const parsed = Number(raw)
  return VALID_PAGE_SIZES.includes(parsed) ? (parsed as ListPageSize) : null
}

/** Persists the user's page-size choice (no-op during SSR). */
export function writeRememberedPageSize(size: ListPageSize): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(CLAIMS_PAGE_SIZE_STORAGE_KEY, String(size))
}

/**
 * The page size to restore on a fresh landing, or null to leave the URL alone.
 * Restores the remembered size only when the URL did not explicitly set one
 * (so shared/explicit links win) and it differs from the current size.
 */
export function pageSizeToRestore(
  urlHasPageSize: boolean,
  remembered: ListPageSize | null,
  current: ListPageSize,
): ListPageSize | null {
  if (urlHasPageSize || remembered === null || remembered === current) {
    return null
  }
  return remembered
}
