import { m } from '@mr/i18n'
import {
  ApiError,
  ClaimKind,
  fetchJson,
  invalidateInternalClaimQueries,
  type DomaceClaimCreateInput,
  type DomaceClaimDetail,
  type EmotiveClaimCreateInput,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { showInternalToast } from '~/lib/internal-toast'

import { serializeDomaceCreateBody } from '../../domace-claims/create/serialize-domace-create-body.js'
import { serializeEmotiveCreateBody } from '../../emotive-claims/create/serialize-emotive-create-body.js'
import { claimDetailTarget } from '../../command-palette/claim-target.js'

export type CreateClaimVariables =
  | { kind: typeof ClaimKind.Emotive; input: EmotiveClaimCreateInput }
  | { kind: typeof ClaimKind.Domace; input: DomaceClaimCreateInput }

/**
 * One mutation for both kinds. The wire is still two endpoints — the two families keep separate
 * routes, loaders and detail screens (docs/04, locked) — but the wizard that feeds them is one,
 * so which endpoint to call is decided here rather than by which screen the person opened.
 *
 * On success it lands on the CLAIM, not back on the list: whoever just entered a claim is about
 * to do something with it, and the old EMOTIVE wizard's jump to the list lost it in a page of
 * rows. The category travels along so the sidebar keeps that entry lit.
 */
export function useCreateClaim() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (
      variables: CreateClaimVariables,
    ): Promise<EmotiveClaimDetail | DomaceClaimDetail> => {
      if (variables.kind === ClaimKind.Domace) {
        return fetchJson<DomaceClaimDetail>('/api/domace-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serializeDomaceCreateBody(variables.input)),
        })
      }
      return fetchJson<EmotiveClaimDetail>('/api/emotive-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeEmotiveCreateBody(variables.input)),
      })
    },
    onSuccess: async (created) => {
      showInternalToast(m.internal_toast_claim_saved({ mrNumber: created.mrNumber ?? '—' }))
      invalidateInternalClaimQueries(queryClient, { kind: created.kind, id: created.id })
      await navigate(claimDetailTarget(created, created.category?.code))
    },
  })
}

export function createClaimErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return m.claims_create_error_generic()
}
