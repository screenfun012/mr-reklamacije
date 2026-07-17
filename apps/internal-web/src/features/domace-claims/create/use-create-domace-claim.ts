import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  ApiError,
  ClaimKind,
  fetchJson,
  invalidateInternalClaimQueries,
  type DomaceClaimCreateInput,
  type DomaceClaimDetail,
} from '@mr/shared'

import { m } from '@mr/i18n'

import { showInternalToast } from '~/lib/internal-toast'

import { serializeDomaceCreateBody } from './serialize-domace-create-body.js'

export function useCreateDomaceClaim() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DomaceClaimCreateInput): Promise<DomaceClaimDetail> =>
      fetchJson<DomaceClaimDetail>('/api/domace-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeDomaceCreateBody(input)),
      }),
    onSuccess: (created) => {
      showInternalToast(m.internal_toast_claim_saved({ mrNumber: created.mrNumber ?? '—' }))
      invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Domace, id: created.id })
    },
  })
}

export function createDomaceClaimErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Greška pri čuvanju reklamacije. Pokušajte ponovo.'
}
