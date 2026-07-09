import { claimReportOptions, type ClaimKind, type ClaimReportContentJson } from '@mr/shared'
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
import { lazy, Suspense, useCallback, useEffect } from 'react'

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

  const { saveStatus, save } = useClaimReportAutosave({
    claimKind,
    claimId,
    canEdit,
    baseline: data?.contentJson ?? null,
  })

  useEffect(() => {
    if (saveStatus === 'error') {
      toast.error(m.claim_report_save_status_error())
    }
  }, [saveStatus])

  const handlePersist = useCallback(
    (payload: { contentJson: ClaimReportContentJson; contentHtml: string }) => {
      save(payload)
    },
    [save],
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
            className="text-xs text-mri-text2"
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
          ) : isError || data === undefined ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-mri-text2">{m.claim_report_save_status_error()}</p>
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
              {/* Stable key: a save must never remount the editor (that was the
                  cursor/toolbar-destroying bug). It remounts only on claim
                  switch. initialContent is read once at mount; later cache
                  updates from a save don't disturb the live editor. */}
              <LazyClaimReportEditor
                key={`${claimKind}:${claimId}`}
                initialContent={data.contentJson}
                editable={canEdit}
                claimKind={claimKind}
                claimId={claimId}
                onPersist={handlePersist}
              />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
