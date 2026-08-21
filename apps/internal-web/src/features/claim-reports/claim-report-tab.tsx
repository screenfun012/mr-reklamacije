import { claimReportOptions, isClaimReportEmpty, type ClaimKind } from '@mr/shared'
import { m } from '@mr/i18n'
import { Skeleton } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'

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

const ACTION_CLASS = 'h-8 w-auto px-3 text-[10.5px] tracking-[0.06em]'

/**
 * The rich report that becomes the client's PDF — the lower card of the Izveštaj tab. The upper
 * one is the EN inspection report the portal shows; the two are different documents with
 * different mutations, and are deliberately NOT merged into one save (Nikola, 2026-08-21).
 *
 * No solid-red button here: the brandbook keeps red for the brand and for destructive outlines,
 * and "Napravi izveštaj" is neither (spec §0/§7).
 */
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
      <InternalCard title={m.claim_detail_report_pdf_title()}>
        <p className="text-[12.5px] text-mri-text2">{m.claim_report_no_access()}</p>
      </InternalCard>
    )
  }

  const isEmpty = data === undefined || isClaimReportEmpty(data.contentHtml)
  const showExportButtons = canExport && !isEmpty && !isLoading && !isError && data !== undefined

  const actions =
    isLoading || isError ? undefined : (
      <>
        {showExportButtons ? (
          <>
            <InternalButton
              type="button"
              variant="outline"
              className={ACTION_CLASS}
              disabled={isExportingPdf}
              onClick={() => void exportPdf()}
            >
              {m.claim_report_download_pdf()}
            </InternalButton>
            <InternalButton
              type="button"
              variant="outline"
              className={ACTION_CLASS}
              disabled={isExportingDocx}
              onClick={() => void exportDocx()}
            >
              {m.claim_report_download_word()}
            </InternalButton>
          </>
        ) : null}
        {canEdit ? (
          <InternalButton
            type="button"
            variant="primary"
            className={ACTION_CLASS}
            onClick={() => setSheetOpen(true)}
          >
            {isEmpty ? m.claim_report_create() : m.claim_report_edit()}
          </InternalButton>
        ) : null}
      </>
    )

  return (
    <InternalCard
      title={m.claim_detail_report_pdf_title()}
      {...(actions === undefined ? {} : { actions })}
    >
      <div className="flex flex-col gap-[11px]">
        <p className="text-[12px] text-mri-text2">{m.claim_detail_report_pdf_hint()}</p>

        {isLoading ? (
          <Skeleton className="min-h-48 rounded-lg" />
        ) : isError || data === undefined ? (
          <p className="text-[12.5px] text-mri-text2">{m.claim_report_load_error()}</p>
        ) : isEmpty ? (
          <p className="text-[12.5px] italic text-mri-text2">{m.claim_report_empty()}</p>
        ) : (
          <ClaimReportContentView contentHtml={data.contentHtml} />
        )}
      </div>

      <ClaimReportSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        claimKind={claimKind}
        claimId={claimId}
        canEdit={canEdit}
      />
    </InternalCard>
  )
}
