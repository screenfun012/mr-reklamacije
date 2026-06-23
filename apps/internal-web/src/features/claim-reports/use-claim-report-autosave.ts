import {
  CLAIM_REPORT_AUTOSAVE_DEBOUNCE_MS,
  claimReportKeys,
  type ClaimKind,
  type ClaimReportUpsertBody,
  upsertClaimReport,
} from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { useDebouncedValue } from '~/lib/use-debounced-value.js'

export type ClaimReportSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseClaimReportAutosaveOptions {
  claimKind: ClaimKind
  claimId: string
  enabled: boolean
  canEdit: boolean
  draft: ClaimReportUpsertBody | null
  baselineFingerprint: string | null
}

export function useClaimReportAutosave({
  claimKind,
  claimId,
  enabled,
  canEdit,
  draft,
  baselineFingerprint,
}: UseClaimReportAutosaveOptions): { saveStatus: ClaimReportSaveStatus } {
  const queryClient = useQueryClient()
  const queryKey = claimReportKeys.detail(claimKind, claimId)
  const lastSavedFingerprintRef = useRef<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<ClaimReportSaveStatus>('idle')
  const debouncedDraft = useDebouncedValue(draft, CLAIM_REPORT_AUTOSAVE_DEBOUNCE_MS)

  useEffect(() => {
    if (baselineFingerprint !== null) {
      lastSavedFingerprintRef.current = baselineFingerprint
      setSaveStatus('idle')
    }
  }, [baselineFingerprint])

  const { mutate } = useMutation({
    mutationFn: (body: ClaimReportUpsertBody) => upsertClaimReport(claimKind, claimId, body),
    onMutate: () => {
      setSaveStatus('saving')
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKey, data)
      lastSavedFingerprintRef.current = JSON.stringify(variables.contentJson)
      setSaveStatus('saved')
    },
    onError: () => {
      setSaveStatus('error')
    },
  })

  useEffect(() => {
    if (!enabled || !canEdit || debouncedDraft === null) {
      return
    }

    const fingerprint = JSON.stringify(debouncedDraft.contentJson)
    if (lastSavedFingerprintRef.current === fingerprint) {
      return
    }

    mutate(debouncedDraft)
  }, [enabled, canEdit, debouncedDraft, mutate])

  return { saveStatus }
}
