import {
  ClaimDetailTab,
  emotiveClaimDetailOptions,
  formatListDateTime,
  type ClaimDetailTabValue,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Tabs, TabsContent } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { InternalTabsList, InternalTabsTrigger } from '~/components/internal-tabs'

import { EmotiveClaimBasicSection } from './emotive-claim-basic-section.js'
import { EmotiveClaimDetailHeader } from './emotive-claim-detail-header.js'
import { EmotiveClaimFindingsSection } from './emotive-claim-findings-section.js'
import { EmotiveClaimInspectionReportSection } from './emotive-claim-inspection-report-section.js'
import { EmotiveClaimFaultsSection } from './emotive-claim-faults-section.js'
import { EmotiveClaimAttachmentsTab } from './emotive-claim-attachments-tab.js'
import { EmotiveClaimReportTab } from './emotive-claim-report-tab.js'

export interface EmotiveClaimDetailViewProps {
  id: string
  tab: ClaimDetailTabValue
  onTabChange: (tab: ClaimDetailTabValue) => void
}

const rootRoute = getRouteApi('__root__')

function faultsTabLabel(count: number): string {
  return count > 0 ? `${m.claim_detail_tab_faults()} ${count}` : m.claim_detail_tab_faults()
}

export function EmotiveClaimDetailView({
  id,
  tab,
  onTabChange,
}: EmotiveClaimDetailViewProps): React.ReactElement {
  const { data: claim } = useSuspenseQuery(emotiveClaimDetailOptions(id))
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions
  const canChangeOutcome = permissions?.includes('emotive_claims.change_outcome') === true
  const canPublish = permissions?.includes('emotive_claims.publish') === true
  const canEditBasic = permissions?.includes('emotive_claims.update') === true
  const canEditFaults = canEditBasic
  const canEditFindings = permissions?.includes('emotive_claims.update') === true

  const [editingBasic, setEditingBasic] = useState(false)

  const handleTabChange = (nextTab: string): void => {
    const parsed = nextTab as ClaimDetailTabValue
    if (parsed !== ClaimDetailTab.Pregled) {
      setEditingBasic(false)
    }
    onTabChange(parsed)
  }

  const handleEditBasic = (): void => {
    onTabChange(ClaimDetailTab.Pregled)
    setEditingBasic(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <EmotiveClaimDetailHeader
        claim={claim}
        canEditBasic={canEditBasic}
        editingBasic={editingBasic}
        canChangeOutcome={canChangeOutcome}
        canPublish={canPublish}
        onEditBasic={handleEditBasic}
      />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <InternalTabsList aria-label={m.emotive_claims_detail_title()}>
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
          <EmotiveClaimBasicSection
            claim={claim}
            canEdit={canEditBasic}
            editing={editingBasic}
            onEditingChange={setEditingBasic}
            showSectionEditButton={false}
            hideMrInReadOnly
          />

          <EmotiveClaimFindingsSection claim={claim} canEdit={canEditFindings} />

          <EmotiveClaimInspectionReportSection claim={claim} canEdit={canEditFindings} />

          <p className="font-mono text-[11px] tracking-[0.04em] text-mri-text2">
            {m.emotive_claims_detail_field_updated_at()}: {formatListDateTime(claim.updatedAt)}
          </p>
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Kvarovi}>
          <EmotiveClaimFaultsSection claim={claim} canEdit={canEditFaults} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Prilozi}>
          <EmotiveClaimAttachmentsTab claimId={claim.id} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Izvestaj}>
          <EmotiveClaimReportTab claimId={claim.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
