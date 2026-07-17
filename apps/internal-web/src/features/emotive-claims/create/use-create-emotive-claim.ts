import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import {
  ApiError,
  ClaimKind,
  fetchJson,
  invalidateInternalClaimQueries,
  type EmotiveClaimCreateInput,
  type EmotiveClaimDetail,
} from '@mr/shared'

import { m } from '@mr/i18n'

import { showInternalToast } from '~/lib/internal-toast'

import { serializeEmotiveCreateBody } from './serialize-emotive-create-body.js'

export function useCreateEmotiveClaim() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: EmotiveClaimCreateInput): Promise<EmotiveClaimDetail> =>
      fetchJson<EmotiveClaimDetail>('/api/emotive-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeEmotiveCreateBody(input)),
      }),
    onSuccess: async (created) => {
      showInternalToast(m.internal_toast_claim_saved({ mrNumber: created.mrNumber }))
      invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id: created.id })
      await navigate({ to: '/reklamacije', search: { page: 1, pageSize: 10 } })
    },
  })
}

export function createEmotiveClaimErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Greška pri čuvanju reklamacije. Pokušajte ponovo.'
}
