import {
  emotiveClaimDetailOptions,
  FaultType,
  formatListDate,
  formatListDateTime,
  type EmotiveClaimDetail,
  type EmotiveClaimFaultItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { OutcomeBadge } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { EmotiveClaimStatusActions } from './emotive-claim-status-actions'

export interface EmotiveClaimDetailViewProps {
  id: string
}

const rootRoute = getRouteApi('__root__')

export function EmotiveClaimDetailView({ id }: EmotiveClaimDetailViewProps): React.ReactElement {
  const { data: claim } = useSuspenseQuery(emotiveClaimDetailOptions(id))
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions
  const canChangeOutcome = permissions?.includes('emotive_claims.change_outcome') === true
  const canReopen = permissions?.includes('emotive_claims.reopen') === true

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {m.emotive_claims_detail_section_basic()}
          </h2>
          <OutcomeBadge outcome={claim.outcome} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <DetailItem label={m.emotive_claims_col_mr_number()} value={claim.mrNumber} mono />
          <DetailItem label={m.emotive_claims_col_claim_number()} value={claim.claimNumber} />
          <DetailItem label={m.emotive_claims_col_partner()} value={claim.customerName} />
          <DetailItem label={m.emotive_claims_col_engine()} value={claim.engineTypeCode} mono />
          <DetailItem
            label={m.emotive_claims_detail_field_manufacturer()}
            value={claim.engineTypeManufacturer}
          />
          <DetailItem
            label={m.emotive_claims_detail_field_engine_code()}
            value={claim.engineCode}
          />
          <DetailItem label={m.emotive_claims_detail_field_source()} value={resolveSource(claim)} />
          <DetailItem label={m.emotive_claims_col_employee()} value={claim.employeeName} />
          <DetailItem
            label={m.emotive_claims_col_date_received()}
            value={formatListDate(claim.dateOfClaim)}
          />
          <DetailItem
            label={m.emotive_claims_col_date_finish()}
            value={claim.dateOfFinish ? formatListDate(claim.dateOfFinish) : null}
          />
          <DetailItem
            label={m.emotive_claims_detail_field_claim_year()}
            value={String(claim.claimYear)}
          />
        </dl>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">
            {m.emotive_claims_create_field_warranty_report()}
          </span>
          <p className="text-sm whitespace-pre-wrap text-foreground">
            {claim.warrantyReport ?? EMPTY}
          </p>
        </div>
      </section>

      <EmotiveClaimStatusActions
        claimId={claim.id}
        currentOutcome={claim.outcome}
        canChangeOutcome={canChangeOutcome}
        canReopen={canReopen}
      />

      <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
        <h2 className="text-sm font-semibold text-foreground">
          {m.emotive_claims_detail_section_faults()}
        </h2>
        {claim.faults.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.emotive_claims_detail_faults_empty()}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">
                    {m.emotive_claims_create_fault_type()}
                  </th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">
                    {m.emotive_claims_create_review_fault_target()}
                  </th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">
                    {m.emotive_claims_detail_fault_notes()}
                  </th>
                </tr>
              </thead>
              <tbody>
                {claim.faults.map((fault) => (
                  <tr key={fault.id} className="border-t border-border">
                    <td className="px-4 py-2">{faultLabel(fault.faultType)}</td>
                    <td className="px-4 py-2">{resolveFaultTarget(fault)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fault.notes ?? EMPTY}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
        <h2 className="text-sm font-semibold text-foreground">
          {m.emotive_claims_detail_section_notes()}
        </h2>
        {claim.internalNotes ? (
          <p className="text-sm whitespace-pre-wrap text-foreground">{claim.internalNotes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{m.emotive_claims_detail_notes_empty()}</p>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        {m.emotive_claims_detail_field_updated_at()}: {formatListDateTime(claim.updatedAt)}
      </p>
    </div>
  )
}

const EMPTY = '—'

function resolveSource(claim: EmotiveClaimDetail): string | null {
  if (claim.sourceName && claim.sourceCode) {
    return `${claim.sourceName} (${claim.sourceCode})`
  }
  return claim.sourceName ?? claim.sourceCode
}

function resolveFaultTarget(fault: EmotiveClaimFaultItem): string {
  switch (fault.faultType) {
    case FaultType.Employee:
      return fault.employeeName ?? EMPTY
    case FaultType.Department:
      return fault.departmentName ?? EMPTY
    case FaultType.External:
      return fault.externalPartyName ?? EMPTY
    default: {
      const exhaustive: never = fault.faultType
      return exhaustive
    }
  }
}

function faultLabel(faultType: EmotiveClaimFaultItem['faultType']): string {
  switch (faultType) {
    case FaultType.Department:
      return m.emotive_claims_create_fault_type_department()
    case FaultType.Employee:
      return m.emotive_claims_create_fault_type_employee()
    case FaultType.External:
      return m.emotive_claims_create_fault_type_external()
    default: {
      const exhaustive: never = faultType
      return exhaustive
    }
  }
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | null
  mono?: boolean
}): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-xs text-foreground' : 'font-medium text-foreground'}>
        {value ?? EMPTY}
      </dd>
    </div>
  )
}
