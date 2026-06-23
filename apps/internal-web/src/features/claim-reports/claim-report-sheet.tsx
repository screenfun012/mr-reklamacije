import {
  claimReportOptions,
  type ClaimKind,
  type ClaimReportContentJson,
  type ClaimReportUpsertBody,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
  toast,
} from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'

import { type ClaimReportSaveStatus, useClaimReportAutosave } from './use-claim-report-autosave.js'

const LazyClaimReportEditor = lazy(() => import('./claim-report-editor.js'))

export interface ClaimReportSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  claimKind: ClaimKind
  claimId: string
  canEdit: boolean
}

function saveStatusLabel(status: ClaimReportSaveStatus): string {
  switch (status) {
    case 'idle':
      return m.claim_report_save_status_idle()
    case 'saving':
      return m.claim_report_save_status_saving()
    case 'saved':
      return m.claim_report_save_status_saved()
    case 'error':
      return m.claim_report_save_status_error()
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function ClaimReportSheet({
  open,
  onOpenChange,
  claimKind,
  claimId,
  canEdit,
}: ClaimReportSheetProps): React.ReactElement {
  const { data, isLoading, isError } = useQuery({
    ...claimReportOptions(claimKind, claimId),
    enabled: open,
  })

  const [draft, setDraft] = useState<ClaimReportUpsertBody | null>(null)
  const baselineFingerprint = useMemo(() => {
    if (data === undefined) {
      return null
    }

    return JSON.stringify(data.contentJson)
  }, [data])

  useEffect(() => {
    if (data === undefined) {
      return
    }

    setDraft({
      contentJson: data.contentJson,
      contentHtml: data.contentHtml,
    })
  }, [data])

  const { saveStatus } = useClaimReportAutosave({
    claimKind,
    claimId,
    enabled: open,
    canEdit,
    draft,
    baselineFingerprint,
  })

  useEffect(() => {
    if (saveStatus === 'error') {
      toast.error(m.claim_report_save_status_error())
    }
  }, [saveStatus])

  const handleEditorChange = useCallback(
    (payload: { contentJson: ClaimReportContentJson; contentHtml: string }) => {
      setDraft(payload)
    },
    [],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        wide
        className="flex h-[90vh] max-h-[90vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden"
      >
        <DialogHeader className="flex-row items-center justify-between gap-4 space-y-0 px-6 pt-6">
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{m.claim_report_sheet_title()}</DialogTitle>
            <DialogDescription>{m.claim_report_sheet_description()}</DialogDescription>
          </div>
          <p
            className="text-xs text-muted-foreground"
            aria-live="polite"
            data-testid="claim-report-save-status"
          >
            {saveStatusLabel(saveStatus)}
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {isLoading ? (
            <div className="flex flex-1 flex-col gap-3 p-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="min-h-[20rem] flex-1 rounded-md" />
            </div>
          ) : isError || data === undefined || draft === null ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-muted-foreground">{m.claim_report_save_status_error()}</p>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="min-h-[20rem] flex-1 rounded-md" />
                </div>
              }
            >
              <LazyClaimReportEditor
                key={`${claimKind}:${claimId}:${data.updatedAt ?? 'new'}`}
                initialContent={draft.contentJson}
                editable={canEdit}
                claimKind={claimKind}
                claimId={claimId}
                onChange={handleEditorChange}
              />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
