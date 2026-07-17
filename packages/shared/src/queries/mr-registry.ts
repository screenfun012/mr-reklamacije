import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { ApiError } from '../api/api-error.js'
import { fetchParsed } from '../api/fetch-json.js'
import { ClaimKind } from '../enums.js'

export const MrRegistryExistingClaimSchema = z.object({
  kind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]),
  claimId: z.string(),
})

export type MrRegistryExistingClaim = z.infer<typeof MrRegistryExistingClaimSchema>

const MrRegistryLookupResponseSchema = MrRegistryExistingClaimSchema.nullable()

const MR_REGISTRY_LOOKUP_STALE_MS = 30_000

export const mrRegistryKeys = {
  all: ['mr-registry'] as const,
  lookup: (mr: string) => [...mrRegistryKeys.all, 'lookup', mr] as const,
}

export function mrRegistryLookupOptions(mr: string) {
  return queryOptions({
    queryKey: mrRegistryKeys.lookup(mr),
    queryFn: () =>
      fetchParsed(
        `/api/mr-registry/lookup?mr=${encodeURIComponent(mr)}`,
        MrRegistryLookupResponseSchema,
      ),
    staleTime: MR_REGISTRY_LOOKUP_STALE_MS,
  })
}

/**
 * Extracts the conflicting claim from a create 409: the API attaches
 * `{ kind, claimId }` as `details` on an MR-key conflict so the form can
 * link straight to the claim that already owns the number.
 */
export function mrConflictFromError(error: unknown): MrRegistryExistingClaim | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null
  }
  const parsed = MrRegistryExistingClaimSchema.safeParse(error.details)
  return parsed.success ? parsed.data : null
}
