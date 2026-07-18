import {
  ClaimDetailTab,
  ClaimOutcome,
  domaceClaimDetailOptions,
  formatListDateTime,
  type ClaimDetailTabValue,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Tabs, TabsContent } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { InternalTabsList, InternalTabsTrigger } from '~/components/internal-tabs'

import { DomaceClaimAmountSection } from './domace-claim-amount-section.js'
import { DomaceClaimBasicSection } from './domace-claim-basic-section.js'
import { DomaceClaimDetailHeader } from './domace-claim-detail-header.js'
import { DomaceClaimFindingsSection } from './domace-claim-findings-section.js'
import { DomaceClaimInspectionReportSection } from './domace-claim-inspection-report-section.js'
import { DomaceClaimFaultsSection } from './domace-claim-faults-section.js'
import { DomaceClaimOverviewEdit } from './domace-claim-overview-edit.js'
import { DomaceClaimAttachmentsTab } from './domace-claim-attachments-tab.js'
import { DomaceClaimReportTab } from './domace-claim-report-tab.js'

export interface DomaceClaimDetailViewProps {
  id: string
  tab: ClaimDetailTabValue
  onTabChange: (tab: ClaimDetailTabValue) => void
}

const rootRoute = getRouteApi('__root__')

function faultsTabLabel(count: number): string {
  return count > 0 ? `${m.claim_detail_tab_faults()} ${count}` : m.claim_detail_tab_faults()
}

export function DomaceClaimDetailView({
  id,
  tab,
  onTabChange,
}: DomaceClaimDetailViewProps): React.ReactElement {
  const { data: claim } = useSuspenseQuery(domaceClaimDetailOptions(id))
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions
  const canChangeOutcome = permissions?.includes('domace_claims.change_outcome') === true
  const canEditBasic = permissions?.includes('domace_claims.update') === true
  const canEditFaults = canEditBasic
  const canEditAmount =
    claim.outcome === ClaimOutcome.Accepted &&
    permissions?.includes('domace_claims.update') === true
  const canEditFindings = permissions?.includes('domace_claims.update') === true
  const canEditData = canEditBasic || canEditAmount

  const [editingData, setEditingData] = useState(false)

  const handleTabChange = (nextTab: string): void => {
    const parsed = nextTab as ClaimDetailTabValue
    if (parsed !== ClaimDetailTab.Pregled) {
      setEditingData(false)
    }
    onTabChange(parsed)
  }

  const handleEditData = (): void => {
    onTabChange(ClaimDetailTab.Pregled)
    setEditingData(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <DomaceClaimDetailHeader
        claim={claim}
        canEditData={canEditData}
        editingData={editingData}
        canChangeOutcome={canChangeOutcome}
        onEditData={handleEditData}
      />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <InternalTabsList aria-label={m.domace_claims_detail_title()}>
          <InternalTabsTrigger value={ClaimDetailTab.Pregled}>
            {m.claim_detail_tab_overview()}
          </InternalTabsTrigger>
          <InternalTabsTrigger value={ClaimDetailTab.Kvarovi}>
            {faultsTabLabel(claim.faults.length)}
          </InternalTabsTrigger>
          <InternalTabsTrigger value={ClaimDetailTab.Prilozi}>
            {m.claim_detail_tab_attachments()}
          </InternalTabsTrigger>
          <InternalTabsTrigger value={ClaimDetailTab.Izvestaj}>
            {m.claim_detail_tab_report()}
          </InternalTabsTrigger>
        </InternalTabsList>

        <TabsContent value={ClaimDetailTab.Pregled} className="flex flex-col gap-6">
          {editingData ? (
            <DomaceClaimOverviewEdit claim={claim} onDone={() => setEditingData(false)} />
          ) : (
            <>
              <DomaceClaimBasicSection
                claim={claim}
                canEdit={canEditBasic}
                showSectionEditButton={false}
                hideMrInReadOnly
              />
              <DomaceClaimAmountSection claim={claim} />
            </>
          )}

          <DomaceClaimFindingsSection claim={claim} canEdit={canEditFindings} />

          <DomaceClaimInspectionReportSection claim={claim} canEdit={canEditFindings} />

          <p className="font-mono text-[11px] tracking-[0.04em] text-mri-text2">
            {m.emotive_claims_detail_field_updated_at()}: {formatListDateTime(claim.updatedAt)}
          </p>
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Kvarovi}>
          <DomaceClaimFaultsSection claim={claim} canEdit={canEditFaults} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Prilozi}>
          <DomaceClaimAttachmentsTab claimId={claim.id} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Izvestaj}>
          <DomaceClaimReportTab claimId={claim.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
