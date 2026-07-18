import { claimReportOptions, isClaimReportEmpty, type ClaimKind } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Skeleton } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { ClaimReportContentView } from './claim-report-content-view.js'
import { ClaimReportSheet } from './claim-report-sheet.js'
import { useClaimReportExport } from './use-claim-report-export.js'

export interface ClaimReportTabProps {
  claimKind: ClaimKind
  claimId: string
  canView: boolean
  canEdit: boolean
  canExport: boolean
}

interface ClaimReportTabHeaderProps {
  children?: ReactNode
}

function ClaimReportTabHeader({ children }: ClaimReportTabHeaderProps): React.ReactElement {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-mri-border bg-mri-hdr py-2 backdrop-blur-sm">
      {children}
    </div>
  )
}

export function ClaimReportTab({
  claimKind,
  claimId,
  canView,
  canEdit,
  canExport,
}: ClaimReportTabProps): React.ReactElement {
  const [sheetOpen, setSheetOpen] = useState(false)
  const { exportPdf, exportDocx, isExportingPdf, isExportingDocx } = useClaimReportExport(
    claimKind,
    claimId,
  )
  const { data, isLoading, isError } = useQuery({
    ...claimReportOptions(claimKind, claimId),
    enabled: canView,
  })

  if (!canView) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-mri-border p-8">
        <p className="text-sm text-mri-text2">{m.claim_report_no_access()}</p>
      </div>
    )
  }

  const isEmpty = data === undefined || isClaimReportEmpty(data.contentHtml)
  const showExportButtons = canExport && !isEmpty && !isLoading && !isError && data !== undefined

  const exportButtons = showExportButtons ? (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={isExportingPdf}
        onClick={() => void exportPdf()}
      >
        {m.claim_report_download_pdf()}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isExportingDocx}
        onClick={() => void exportDocx()}
      >
        {m.claim_report_download_word()}
      </Button>
    </>
  ) : null

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end border-b border-mri-border py-2">
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <Skeleton className="min-h-48 rounded-lg" />
        </div>
      ) : isError || data === undefined ? (
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-mri-border p-8">
          <p className="text-sm text-mri-text2">{m.claim_report_load_error()}</p>
        </div>
      ) : isEmpty ? (
        <ClaimReportTabHeader>
          <p className="mr-auto text-sm text-mri-text2">{m.claim_report_empty()}</p>
          {canEdit ? (
            <Button type="button" onClick={() => setSheetOpen(true)}>
              {m.claim_report_create()}
            </Button>
          ) : null}
        </ClaimReportTabHeader>
      ) : (
        <div className="flex min-h-0 flex-col gap-3">
          {canEdit || showExportButtons ? (
            <ClaimReportTabHeader>
              {exportButtons}
              {canEdit ? (
                <Button type="button" onClick={() => setSheetOpen(true)}>
                  {m.claim_report_edit()}
                </Button>
              ) : null}
            </ClaimReportTabHeader>
          ) : null}
          <ClaimReportContentView contentHtml={data.contentHtml} />
        </div>
      )}

      <ClaimReportSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        claimKind={claimKind}
        claimId={claimId}
        canEdit={canEdit}
      />
    </div>
  )
}
