import { findMrCandidates, mrRegistryLookupOptions, type MrRegistryExistingClaim } from '@mr/shared'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

/**
 * Which of the MR numbers written in these messages name a real claim.
 *
 * ⚠ Resolved for the WHOLE list at once, deliberately: a chip that asked for itself would fire a
 * request per number per message, and the same number said ten times in a busy channel would cost
 * ten — against a session limit of 120 requests a minute shared with the rest of the app. Here a
 * number is asked about once, however often it was typed.
 *
 * A key that resolves to nothing is simply absent from the map: the chip then stays plain text.
 */
export function useMrResolutions(
  bodies: readonly string[],
): ReadonlyMap<string, MrRegistryExistingClaim> {
  const joined = bodies.join('\n')
  const keys = useMemo(() => {
    const distinct = new Set<string>()
    for (const body of bodies) {
      for (const candidate of findMrCandidates(body)) {
        for (const key of candidate.keys) {
          distinct.add(key)
        }
      }
    }
    // Sorted so the query list keeps a stable order across renders.
    return [...distinct].sort()
    // Keyed on the TEXTS, not on the array's identity: the list rebuilds its array every render,
    // and re-parsing fifty message bodies each time is the cost this memo exists to avoid.
  }, [joined])

  const results = useQueries({ queries: keys.map((key) => mrRegistryLookupOptions(key)) })

  return useMemo(() => {
    const resolved = new Map<string, MrRegistryExistingClaim>()
    keys.forEach((key, index) => {
      const claim = results[index]?.data
      if (claim !== undefined && claim !== null) {
        resolved.set(key, claim)
      }
    })
    return resolved
  }, [keys, results])
}
