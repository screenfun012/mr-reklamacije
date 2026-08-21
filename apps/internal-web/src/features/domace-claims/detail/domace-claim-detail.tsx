import {
  attachmentsListOptions,
  ClaimDetailTab,
  ClaimKind,
  ClaimOutcome,
  domaceClaimDetailOptions,
  formatListDateTime,
  type ClaimDetailTabValue,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Tabs, TabsContent } from '@mr/ui'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { InternalTabCount, InternalTabsList, InternalTabsTrigger } from '~/components/internal-tabs'

import { DomaceClaimAmountSection } from './domace-claim-amount-section.js'
import { ClaimAttachmentsCard } from '../../claims/claim-attachments-card'
import { ClaimFaultsCard } from '../../claims/claim-faults-card'
import { CategoryFieldsCard } from '../../claims/category-fields/category-fields-card'
import { DomaceClaimBasicSection } from './domace-claim-basic-section.js'
import { ClaimPresenceBar } from '../../claims/claim-presence-bar'
import { DomaceClaimDetailHeader } from './domace-claim-detail-header.js'
import { DomaceClaimFindingsSection } from './domace-claim-findings-section.js'
import { DomaceClaimOverviewEdit } from './domace-claim-overview-edit.js'
import { DomaceClaimAttachmentsTab } from './domace-claim-attachments-tab.js'
import { DomaceClaimReportTab } from './domace-claim-report-tab.js'

export interface DomaceClaimDetailViewProps {
  id: string
  tab: ClaimDetailTabValue
  categoryCode?: string | undefined
  onTabChange: (tab: ClaimDetailTabValue) => void
}

const rootRoute = getRouteApi('__root__')

/** The same four tabs as EMOTIVE (handoff §5) — DOMAĆA simply has no client to publish to. */
export function DomaceClaimDetailView({
  id,
  tab,
  categoryCode,
  onTabChange,
}: DomaceClaimDetailViewProps): React.ReactElement {
  const { data: claim } = useSuspenseQuery(domaceClaimDetailOptions(id))
  // Only for the tab's counter — the same query the photo card already runs.
  const { data: attachments } = useQuery(attachmentsListOptions(ClaimKind.Domace, id))
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions
  const canChangeOutcome = permissions?.includes('domace_claims.change_outcome') === true
  const canEditBasic = permissions?.includes('domace_claims.update') === true
  const canEditAmount =
    claim.outcome === ClaimOutcome.Accepted &&
    permissions?.includes('domace_claims.update') === true
  const canEditFindings = canEditBasic
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
    <div className="flex flex-col gap-4">
      <DomaceClaimDetailHeader
        claim={claim}
        canEditData={canEditData}
        editingData={editingData}
        canChangeOutcome={canChangeOutcome}
        categoryCode={categoryCode}
        onEditData={handleEditData}
      />

      <ClaimPresenceBar kind={ClaimKind.Domace} id={claim.id} />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <InternalTabsList aria-label={m.domace_claims_detail_title()}>
          <InternalTabsTrigger value={ClaimDetailTab.Pregled}>
            {m.claim_detail_tab_overview()}
          </InternalTabsTrigger>
          <InternalTabsTrigger value={ClaimDetailTab.Nalazi}>
            {m.claim_detail_tab_findings()}
            <InternalTabCount count={claim.findings?.length ?? 0} />
          </InternalTabsTrigger>
          <InternalTabsTrigger value={ClaimDetailTab.Prilozi}>
            {m.claim_detail_tab_attachments()}
            <InternalTabCount count={attachments?.items.length ?? 0} />
          </InternalTabsTrigger>
          <InternalTabsTrigger value={ClaimDetailTab.Izvestaj}>
            {m.claim_detail_tab_report()}
          </InternalTabsTrigger>
        </InternalTabsList>

        {/* Same two columns as EMOTIVE (prototype §6) — but no "Klijent vidi": a DOMAĆA claim
            has no portal, so there is nothing for a client to be looking at. */}
        <TabsContent
          value={ClaimDetailTab.Pregled}
          // The container is THIS element; the grid that queries it must be a child — an
          // element cannot be its own container, which is how the two columns silently
          // collapsed into one at 1600px (measured in the browser, 2026-08-21).
          className="@container/overview"
        >
          <div className="grid items-start gap-4 @min-[1100px]/overview:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-4">
              {editingData ? (
                <DomaceClaimOverviewEdit claim={claim} onDone={() => setEditingData(false)} />
              ) : (
                <>
                  <DomaceClaimBasicSection claim={claim} hideMr />
                  <DomaceClaimAmountSection claim={claim} />

                  {claim.category === null ? null : (
                    <CategoryFieldsCard
                      categoryId={claim.category.id}
                      categoryName={claim.category.name}
                      values={claim.categoryFieldValues}
                      previous={claim.previousCategoryFieldValues}
                      missing={claim.missingRequiredCategoryFields}
                    />
                  )}

                  <ClaimFaultsCard faults={claim.faults} />
                </>
              )}

              <p className="font-mono text-[11px] tracking-[0.04em] text-mri-text2">
                {m.emotive_claims_detail_field_updated_at()}: {formatListDateTime(claim.updatedAt)}
              </p>
            </div>

            <aside className="flex flex-col gap-4">
              <ClaimAttachmentsCard
                kind={ClaimKind.Domace}
                claimId={claim.id}
                attachmentsTab={{
                  to: '/reklamacije/domace/$id',
                  params: { id: claim.id },
                  search: { tab: ClaimDetailTab.Prilozi },
                }}
              />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Nalazi}>
          <DomaceClaimFindingsSection claim={claim} canEdit={canEditFindings} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Prilozi}>
          <DomaceClaimAttachmentsTab claimId={claim.id} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Izvestaj}>
          <DomaceClaimReportTab claim={claim} canEditInspection={canEditFindings} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
