import { m } from '@mr/i18n'
import { stripClientVisibleMarker, type ClientClaimDetail } from '@mr/shared'

import { MaskedIcon } from '~/components/masked-icon'
import { SectionNewBadge } from '~/components/section-new-badge'

import { claimServiceType, serviceTypeLabel } from './claim-status-presentation'

function BasicsCell({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="mb-[5px] font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mrp-text2">
        {label}
      </div>
      <div
        className={
          mono ? 'break-all font-mono text-[14px] font-semibold' : 'text-[15px] font-semibold'
        }
      >
        {value}
      </div>
    </div>
  )
}

export function BasicsCard({ claim }: { claim: ClientClaimDetail }) {
  return (
    <div
      className="mrp-fade-up rounded-[15px] border border-mrp-border bg-mrp-surface p-7"
      style={{ animationDelay: '0.18s' }}
    >
      <div className="mb-[22px] flex items-center gap-2.5">
        <h2 className="text-[17px] font-extrabold">{m.portal_detail_basics()}</h2>
        {claim.sectionFreshness.details && <SectionNewBadge />}
      </div>
      <div className="grid grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-2">
        <BasicsCell label={m.portal_detail_field_ref()} value={claim.claimNumber ?? '—'} mono />
        <BasicsCell label={m.portal_detail_field_customer()} value={claim.customerName ?? '—'} />
        <BasicsCell label={m.portal_detail_field_engine()} value={claim.engineTypeCode ?? '—'} />
        <BasicsCell
          label={m.portal_detail_field_manufacturer()}
          value={claim.manufacturerName ?? claim.engineTypeManufacturer ?? '—'}
        />
        <BasicsCell label={m.portal_detail_field_serial()} value={claim.engineCode ?? '—'} mono />
        <BasicsCell
          label={m.portal_detail_field_service()}
          value={serviceTypeLabel(claimServiceType())}
        />
      </div>
    </div>
  )
}

export function ReportedProblemCard({ claim }: { claim: ClientClaimDetail }) {
  // The client's own reported problem — unreachable elsewhere once the submission is converted.
  if (!claim.warrantyReport) return null
  return (
    <div
      className="mrp-fade-up rounded-[15px] border border-mrp-border bg-mrp-surface p-7"
      style={{ animationDelay: '0.21s' }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <h2 className="text-[17px] font-extrabold">{m.portal_detail_problem()}</h2>
        {claim.sectionFreshness.details && <SectionNewBadge />}
      </div>
      <p className="whitespace-pre-line text-[15px] leading-[1.65]">{claim.warrantyReport}</p>
    </div>
  )
}

export function InspectionCard({ claim }: { claim: ClientClaimDetail }) {
  const report = claim.inspectionReport
  return (
    <div
      className="mrp-fade-up rounded-[15px] border border-mrp-border bg-mrp-surface p-7"
      style={{ animationDelay: '0.24s' }}
    >
      <div className="mb-4 flex items-center gap-[11px]">
        <MaskedIcon name="cog" className="size-[17px] text-mrp-red" />
        <h2 className="text-[17px] font-extrabold">{m.portal_detail_inspection()}</h2>
        {claim.sectionFreshness.inspection && <SectionNewBadge />}
      </div>
      {report !== null && report !== '' ? (
        <p className="whitespace-pre-line text-[15px] leading-[1.65]">
          {stripClientVisibleMarker(report)}
        </p>
      ) : (
        <p className="text-[14.5px] italic leading-[1.6] text-mrp-text2">
          {m.portal_detail_inspection_pending()}
        </p>
      )}
    </div>
  )
}
