import {
  claimReportKeys,
  type ClaimKind,
  type ClaimReportContentJson,
  type ClaimReportUpsertBody,
  upsertClaimReport,
} from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

export type ClaimReportSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseClaimReportAutosaveOptions {
  claimKind: ClaimKind
  claimId: string
  canEdit: boolean
  /** Server content the editor was seeded with — establishes the dirty baseline. */
  baseline: ClaimReportContentJson | null
}

export interface ClaimReportAutosave {
  saveStatus: ClaimReportSaveStatus
  /**
   * Persist the given content when it differs from the last saved snapshot.
   * Fired on editor blur and on close/unmount — never on a timer, so typing is
   * never interrupted (no mid-edit remount). Deliberately NOT gated on the
   * sheet's `open` flag: the editor's unmount-flush calls this while the sheet
   * is already closing, and the hook lives in the always-mounted sheet, so the
   * final edit is persisted on close.
   */
  save: (body: ClaimReportUpsertBody) => void
}

export function useClaimReportAutosave({
  claimKind,
  claimId,
  canEdit,
  baseline,
}: UseClaimReportAutosaveOptions): ClaimReportAutosave {
  const queryClient = useQueryClient()
  const lastSavedFingerprintRef = useRef<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<ClaimReportSaveStatus>('idle')

  useEffect(() => {
    if (baseline !== null) {
      lastSavedFingerprintRef.current = JSON.stringify(baseline)
      setSaveStatus('idle')
    }
  }, [baseline])

  const { mutate } = useMutation({
    mutationFn: (body: ClaimReportUpsertBody) => upsertClaimReport(claimKind, claimId, body),
    onMutate: () => {
      setSaveStatus('saving')
    },
    onSuccess: (data, variables) => {
      // The response echoes exactly what we saved (+ a fresh updatedAt). With a
      // stable editor key and no draft re-seed, writing it into the cache only
      // refreshes the read-only content view and reopen — it never disturbs the
      // live editor. No refetch needed.
      queryClient.setQueryData(claimReportKeys.detail(claimKind, claimId), data)
      lastSavedFingerprintRef.current = JSON.stringify(variables.contentJson)
      setSaveStatus('saved')
    },
    onError: () => {
      setSaveStatus('error')
    },
  })

  const save = useCallback(
    (body: ClaimReportUpsertBody) => {
      if (!canEdit) {
        return
      }
      const fingerprint = JSON.stringify(body.contentJson)
      if (fingerprint === lastSavedFingerprintRef.current) {
        return
      }
      mutate(body)
    },
    [canEdit, mutate],
  )

  return { saveStatus, save }
}
