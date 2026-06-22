import {
  ClaimDetailTab,
  ClaimOutcome,
  emotiveClaimDetailOptions,
  formatListDateTime,
  type ClaimDetailTabValue,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  ClaimDetailTabPlaceholder,
  Heading,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { EmotiveClaimBasicSection } from './emotive-claim-basic-section.js'
import { EmotiveClaimDetailHeader } from './emotive-claim-detail-header.js'
import { EmotiveClaimFaultsSection } from './emotive-claim-faults-section.js'

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
  const canReopen = permissions?.includes('emotive_claims.reopen') === true
  const canEditBasic =
    claim.outcome === ClaimOutcome.Pending &&
    permissions?.includes('emotive_claims.update') === true
  const canEditFaults = canEditBasic

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
        canReopen={canReopen}
        onEditBasic={handleEditBasic}
      />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList aria-label={m.emotive_claims_detail_title()}>
          <TabsTrigger value={ClaimDetailTab.Pregled}>{m.claim_detail_tab_overview()}</TabsTrigger>
          <TabsTrigger value={ClaimDetailTab.Kvarovi}>
            {faultsTabLabel(claim.faults.length)}
          </TabsTrigger>
          <TabsTrigger value={ClaimDetailTab.Prilozi}>
            {m.claim_detail_tab_attachments()}
          </TabsTrigger>
          <TabsTrigger value={ClaimDetailTab.Izvestaj}>{m.claim_detail_tab_report()}</TabsTrigger>
        </TabsList>

        <TabsContent value={ClaimDetailTab.Pregled} className="flex flex-col gap-6">
          <EmotiveClaimBasicSection
            claim={claim}
            canEdit={canEditBasic}
            editing={editingBasic}
            onEditingChange={setEditingBasic}
            showSectionEditButton={false}
            hideMrInReadOnly
          />

          <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
            <Heading level="h3" as="h2" className="text-foreground">
              {m.emotive_claims_detail_section_notes()}
            </Heading>
            {claim.internalNotes ? (
              <p className="text-sm whitespace-pre-wrap text-foreground">{claim.internalNotes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {m.emotive_claims_detail_notes_empty()}
              </p>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            {m.emotive_claims_detail_field_updated_at()}: {formatListDateTime(claim.updatedAt)}
          </p>
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Kvarovi}>
          <EmotiveClaimFaultsSection claim={claim} canEdit={canEditFaults} />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Prilozi}>
          <ClaimDetailTabPlaceholder />
        </TabsContent>

        <TabsContent value={ClaimDetailTab.Izvestaj}>
          <ClaimDetailTabPlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  )
}
