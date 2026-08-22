import {
  attachmentsListOptions,
  ClaimDetailTab,
  ClaimKind,
  emotiveClaimDetailOptions,
  formatListDateTime,
  type ClaimDetailTabValue,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Tabs, TabsContent } from '@mr/ui'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { InternalTabCount, InternalTabsList, InternalTabsTrigger } from '~/components/internal-tabs'

import { ClaimPresenceBar } from '../../claims/claim-presence-bar'
import { ClaimAttachmentsCard } from '../../claims/claim-attachments-card'
import { ClaimFaultsCard } from '../../claims/claim-faults-card'
import { CategoryFieldsCard } from '../../claims/category-fields/category-fields-card'
import { EmotiveClaimClientViewCard } from './emotive-claim-client-view-card.js'
import { EmotiveClaimBasicSection } from './emotive-claim-basic-section.js'
import { EmotiveClaimDataEdit } from './emotive-claim-data-edit.js'
import { EmotiveClaimDetailHeader } from './emotive-claim-detail-header.js'
import { EmotiveClaimFindingsSection } from './emotive-claim-findings-section.js'
import { EmotiveClaimAttachmentsTab } from './emotive-claim-attachments-tab.js'
import { EmotiveClaimReportTab } from './emotive-claim-report-tab.js'

export interface EmotiveClaimDetailViewProps {
  id: string
  tab: ClaimDetailTabValue
  categoryCode?: string | undefined
  onTabChange: (tab: ClaimDetailTabValue) => void
}

const rootRoute = getRouteApi('__root__')

/**
 * The claim, in four tabs that actually divide the work (handoff §5):
 *
 *   Pregled  — what the claim IS, read-only; one "Izmeni podatke" opens all of it at once
 *   Nalazi   — the shop's internal notes
 *   Prilozi  — the evidence
 *   Izveštaj — what the client gets, and the button that hands it over
 *
 * Before this, every editor was stacked on Pregled and the tabs decorated a page that already
 * showed everything, with three green SAČUVAJ buttons on it.
 */
export function EmotiveClaimDetailView({
  id,
  tab,
  categoryCode,
  onTabChange,
}: EmotiveClaimDetailViewProps): React.ReactElement {
  const { data: claim } = useSuspenseQuery(emotiveClaimDetailOptions(id))
  // Only for the tab's counter — the same query the photo card already runs, so it costs
  // nothing extra, and a claim still opens when the attachment list is slow.
  const { data: attachments } = useQuery(attachmentsListOptions(ClaimKind.Emotive, id))
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions
  const canChangeOutcome = permissions?.includes('emotive_claims.change_outcome') === true
  const canPublish = permissions?.includes('emotive_claims.publish') === true
  const canEditBasic = permissions?.includes('emotive_claims.update') === true
  const canEditFindings = canEditBasic

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
    <div className="flex flex-col gap-4">
      <EmotiveClaimDetailHeader
        claim={claim}
        canEditBasic={canEditBasic}
        editingBasic={editingBasic}
        canChangeOutcome={canChangeOutcome}
        categoryCode={categoryCode}
        onEditBasic={handleEditBasic}
      />

      <ClaimPresenceBar kind={ClaimKind.Emotive} id={claim.id} />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <InternalTabsList aria-label={m.emotive_claims_detail_title()}>
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

        {/* The prototype's overview is two columns: the claim on the left, what the CLIENT sees
            and the photos on the right (§6). */}
        <TabsContent
          value={ClaimDetailTab.Pregled}
          // The container is THIS element; the grid that queries it must be a child — an
          // element cannot be its own container, which is how the two columns silently
          // collapsed into one at 1600px (measured in the browser, 2026-08-21).
          className="@container/overview"
        >
          <div className="grid items-start gap-4 @min-[1100px]/overview:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-4">
              {editingBasic ? (
                <EmotiveClaimDataEdit claim={claim} onDone={() => setEditingBasic(false)} />
              ) : (
                <>
                  <EmotiveClaimBasicSection claim={claim} hideMr />

                  {claim.category === null ? null : (
                    <CategoryFieldsCard
                      categoryId={claim.category.id}
                      categoryName={claim.category.name}
                      values={claim.categoryFieldValues}
                      previous={claim.previousCategoryFieldValues}
                      missing={claim.missingRequiredCategoryFields}
                      {...(canEditBasic
                        ? { claim: { id: claim.id, kind: ClaimKind.Emotive } }
                        : {})}
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
              <EmotiveClaimClientViewCard claim={claim} canPublish={canPublish} />
              <ClaimAttachmentsCard
                kind={ClaimKind.Emotive}
                claimId={claim.id}
                attachmentsTab={{
                  to: '/reklamacije/emotive/$id',
                  params: { id: claim.id },
                  search: { tab: ClaimDetailTab.Prilozi },
                }}
              />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Nalazi}>
          <EmotiveClaimFindingsSection claim={claim} canEdit={canEditFindings} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Prilozi}>
          <EmotiveClaimAttachmentsTab claimId={claim.id} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Izvestaj}>
          <EmotiveClaimReportTab
            claim={claim}
            canEditInspection={canEditFindings}
            canPublish={canPublish}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
