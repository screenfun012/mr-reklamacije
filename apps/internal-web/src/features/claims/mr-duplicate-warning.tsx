import { useQuery } from '@tanstack/react-query'

import { mrRegistryLookupOptions, normalizeMrKey, useDebouncedValue } from '@mr/shared'
import { m } from '@mr/i18n'

import { MrConflictLink } from './mr-conflict-link.js'

const MR_LOOKUP_DEBOUNCE_MS = 300

/**
 * Non-blocking duplicate check under the MR-number input: while the user types,
 * asks the registry whether the number is already taken and, if so, links to the
 * claim that owns it. The server stays the judge — create still 409s on conflict.
 */
export function MrDuplicateWarning({ mrNumber }: { mrNumber: string }): React.ReactElement | null {
  const debounced = useDebouncedValue(mrNumber, MR_LOOKUP_DEBOUNCE_MS)
  const mrKey = normalizeMrKey(debounced)

  const lookup = useQuery({
    ...mrRegistryLookupOptions(mrKey ?? ''),
    enabled: mrKey !== null,
  })

  const existing = mrKey !== null ? (lookup.data ?? null) : null
  if (existing === null) {
    return null
  }

  return (
    <span className="text-[13px] text-mri-warn" role="status">
      {m.claims_create_mr_conflict_warning()} <MrConflictLink existing={existing} />
    </span>
  )
}
