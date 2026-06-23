import { claimReportOptions, isClaimReportEmpty, type ClaimKind } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Skeleton } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { ClaimReportContentView } from './claim-report-content-view.js'
import { ClaimReportSheet } from './claim-report-sheet.js'

export interface ClaimReportTabProps {
  claimKind: ClaimKind
  claimId: string
  canView: boolean
  canEdit: boolean
  claimLocked: boolean
}

interface ClaimReportTabHeaderProps {
  children?: ReactNode
}

function ClaimReportTabHeader({ children }: ClaimReportTabHeaderProps): React.ReactElement {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-border bg-background/95 py-2 backdrop-blur-sm">
      {children}
    </div>
  )
}

export function ClaimReportTab({
  claimKind,
  claimId,
  canView,
  canEdit,
  claimLocked,
}: ClaimReportTabProps): React.ReactElement {
  const [sheetOpen, setSheetOpen] = useState(false)
  const { data, isLoading, isError } = useQuery({
    ...claimReportOptions(claimKind, claimId),
    enabled: canView,
  })

  if (!canView) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border p-8">
        <p className="text-sm text-muted-foreground">{m.claim_report_no_access()}</p>
      </div>
    )
  }

  const isEmpty = data === undefined || isClaimReportEmpty(data.contentHtml)
  const showEditButton = canEdit && !claimLocked

  return (
    <div className="flex flex-col gap-4">
      {claimLocked ? (
        <p className="text-sm text-muted-foreground">{m.claim_report_locked_hint()}</p>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end border-b border-border py-2">
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <Skeleton className="min-h-48 rounded-lg" />
        </div>
      ) : isError || data === undefined ? (
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border p-8">
          <p className="text-sm text-muted-foreground">{m.claim_report_load_error()}</p>
        </div>
      ) : isEmpty ? (
        <ClaimReportTabHeader>
          <p className="mr-auto text-sm text-muted-foreground">{m.claim_report_empty()}</p>
          {showEditButton ? (
            <Button type="button" onClick={() => setSheetOpen(true)}>
              {m.claim_report_create()}
            </Button>
          ) : null}
        </ClaimReportTabHeader>
      ) : (
        <div className="flex min-h-0 flex-col gap-3">
          {showEditButton ? (
            <ClaimReportTabHeader>
              <Button type="button" onClick={() => setSheetOpen(true)}>
                {m.claim_report_edit()}
              </Button>
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
        canEdit={canEdit && !claimLocked}
      />
    </div>
  )
}
