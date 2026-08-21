import { ClaimKind, type EmotiveClaimDetail } from '@mr/shared'
import { m } from '@mr/i18n'
import { getRouteApi } from '@tanstack/react-router'

import { ClaimReportTab } from '../../claim-reports/claim-report-tab.js'
import { EmotiveClaimPublishedBadge } from '../emotive-claim-published-badge.js'
import { EmotiveClaimInspectionReportSection } from './emotive-claim-inspection-report-section.js'
import { EmotiveClaimPublishAction } from './emotive-claim-publish-action.js'

export interface EmotiveClaimReportTabProps {
  claim: EmotiveClaimDetail
  /** `emotive_claims.update` — who may write the EN report. */
  canEditInspection: boolean
  /** `emotive_claims.publish` — operator + admin. */
  canPublish: boolean
}

const rootRoute = getRouteApi('__root__')

/**
 * "Izveštaj" — what the client gets, in two cards: the EN inspection report the portal shows
 * (with the published badge and Gate B beside it), and below it the rich document that becomes
 * the PDF. Two documents, two mutations, two saves — deliberately not merged (Nikola,
 * 2026-08-21); the tab is what they have in common, not the storage.
 */
export function EmotiveClaimReportTab({
  claim,
  canEditInspection,
  canPublish,
}: EmotiveClaimReportTabProps): React.ReactElement {
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []

  const canView = permissions.includes('claim_reports.view')
  const canEdit = permissions.includes('claim_reports.update')
  const canExport = permissions.includes('claim_reports.export')

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
      <EmotiveClaimInspectionReportSection
        claim={claim}
        canEdit={canEditInspection}
        headerActions={
          <>
            <EmotiveClaimPublishedBadge publishedAt={claim.publishedAt} />
            <EmotiveClaimPublishAction
              claimId={claim.id}
              outcome={claim.outcome}
              publishedAt={claim.publishedAt}
              canPublish={canPublish}
              className="h-8 px-3 text-[10.5px]"
              label={m.emotive_claims_detail_status_action_publish()}
            />
          </>
        }
      />

      <ClaimReportTab
        claimKind={ClaimKind.Emotive}
        claimId={claim.id}
        canView={canView}
        canEdit={canEdit}
        canExport={canExport}
      />
    </div>
  )
}
