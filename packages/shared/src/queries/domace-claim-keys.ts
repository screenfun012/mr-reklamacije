/**
 * React Query key factory for DOMACE claims. Mirrors {@link emotiveClaimKeys}.
 * Kept minimal for Phase 1.2b (create only); list/detail filter keys are added
 * alongside the DOMACE list and detail screens in later phases.
 */
export const domaceClaimKeys = {
  all: ['domace-claims'] as const,
  lists: () => [...domaceClaimKeys.all, 'list'] as const,
  details: () => [...domaceClaimKeys.all, 'detail'] as const,
  detail: (id: string) => [...domaceClaimKeys.details(), id] as const,
}
