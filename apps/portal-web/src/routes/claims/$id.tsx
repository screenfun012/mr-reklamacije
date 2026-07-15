import { m } from '@mr/i18n'
import {
  attachmentsListOptions,
  ClaimKind,
  clientEmotiveClaimDetailOptions,
  stripClientVisibleMarker,
  SUPPORT_EMAIL_BY_KIND,
  type ClientClaimDetail,
} from '@mr/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { MaskedIcon } from '~/components/masked-icon'
import { PortalHeader } from '~/components/portal-header'
import { StatusChip } from '~/components/status-chip'
import {
  claimServiceType,
  serviceTypeLabel,
  statusChipConfig,
} from '~/features/claims/claim-status-presentation'
import { SupportCard } from '~/features/claims/dashboard-cards'
import { DashboardSkeleton } from '~/features/claims/dashboard-skeleton'
import { PhotosCard } from '~/features/claims/photos-card'
import { ReportDownloadCard } from '~/features/claims/report-download-card'
import { TimelineCard } from '~/features/claims/timeline-card'
import { companyInitials, formatPortalClaimId } from '~/lib/portal-format'

export const Route = createFileRoute('/claims/$id')({
  params: {
    parse: (params) => ({ id: z.string().uuid().parse(params.id) }),
  },
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(clientEmotiveClaimDetailOptions(params.id))
    // Prefetch (never throws) so photos are cached before first paint.
    await queryClient.prefetchQuery(attachmentsListOptions(ClaimKind.Emotive, params.id))
  },
  component: ClaimDetailComponent,
  pendingComponent: DashboardSkeleton,
  errorComponent: ClaimDetailError,
})

const detailRoute = getRouteApi('/claims/$id')

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

function BasicsCard({ claim }: { claim: ClientClaimDetail }) {
  return (
    <div
      className="mrp-fade-up rounded-[15px] border border-mrp-border bg-mrp-surface p-7"
      style={{ animationDelay: '0.18s' }}
    >
      <h2 className="mb-[22px] text-[17px] font-extrabold">{m.portal_detail_basics()}</h2>
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

function ReportedProblemCard({ claim }: { claim: ClientClaimDetail }) {
  // The client's own reported problem — unreachable elsewhere once the submission is converted.
  if (!claim.warrantyReport) return null
  return (
    <div
      className="mrp-fade-up rounded-[15px] border border-mrp-border bg-mrp-surface p-7"
      style={{ animationDelay: '0.21s' }}
    >
      <h2 className="mb-4 text-[17px] font-extrabold">{m.portal_detail_problem()}</h2>
      <p className="whitespace-pre-line text-[15px] leading-[1.65]">{claim.warrantyReport}</p>
    </div>
  )
}

function InspectionCard({ claim }: { claim: ClientClaimDetail }) {
  const report = claim.inspectionReport
  return (
    <div
      className="mrp-fade-up rounded-[15px] border border-mrp-border bg-mrp-surface p-7"
      style={{ animationDelay: '0.24s' }}
    >
      <div className="mb-4 flex items-center gap-[11px]">
        <MaskedIcon name="cog" className="size-[17px] text-mrp-red" />
        <h2 className="text-[17px] font-extrabold">{m.portal_detail_inspection()}</h2>
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

function ClaimDetailComponent() {
  const { id } = detailRoute.useParams()
  const { data: claim } = useSuspenseQuery(clientEmotiveClaimDetailOptions(id))

  const chip = statusChipConfig(claim)
  const claimLabel = formatPortalClaimId(claim.mrNumber, claim.claimNumber)
  const technicianName = claim.employeeName
  const supportEmail = SUPPORT_EMAIL_BY_KIND[claim.kind]

  return (
    <div className="relative min-h-screen overflow-hidden bg-mrp-bg">
      <div
        className="mrp-grid-bg absolute inset-0"
        style={{
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 45%)',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 45%)',
        }}
      />
      <PortalHeader company={claim.customerName ?? ''} maxWidthClass="max-w-[1120px]" />

      <div className="relative mx-auto max-w-[1120px] px-5 pb-[72px] pt-8 sm:px-8">
        <Link
          to="/claims"
          className="mrp-fade-up mb-[22px] inline-block text-sm font-semibold text-mrp-text2 transition-colors hover:text-mrp-redh"
        >
          {m.portal_detail_back()}
        </Link>

        <div
          className="mrp-fade-up mb-3 flex flex-wrap items-center gap-4"
          style={{ animationDelay: '0.05s' }}
        >
          <h1 className="font-mono text-[32px] font-bold tracking-[0.01em] sm:text-[40px]">
            {claimLabel}
          </h1>
          <StatusChip config={chip} size="lg" />
        </div>
        <span
          className="mrp-fade-up mb-[30px] inline-block rounded-md border border-mrp-border2 px-[11px] py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mrp-text2"
          style={{ animationDelay: '0.08s' }}
        >
          {serviceTypeLabel(claimServiceType())}
        </span>

        <TimelineCard claim={claim} />

        <div className="grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-[26px]">
            <BasicsCard claim={claim} />
            <ReportedProblemCard claim={claim} />
            <InspectionCard claim={claim} />
            <PhotosCard claimId={claim.id} />
          </div>

          <div className="flex flex-col gap-[26px]">
            <ReportDownloadCard
              claimKind={claim.kind}
              claimId={claim.id}
              fileName={`${claimLabel.replaceAll('/', '-')}.pdf`}
            />
            <SupportCard
              title={m.portal_detail_tech_title()}
              name={technicianName ?? m.portal_support_team()}
              initials={technicianName !== null ? companyInitials(technicianName) : 'MR'}
              email={supportEmail}
              delay="0.28s"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ClaimDetailError({ reset }: { reset: () => void }) {
  return (
    <div className="relative min-h-screen bg-mrp-bg">
      <div className="mx-auto max-w-[1120px] px-8 pt-24">
        <div
          role="alert"
          className="rounded-[14px] border border-[rgba(217,45,32,0.36)] bg-mrp-bad-bg px-6 py-16 text-center"
        >
          <p className="text-sm font-semibold">{m.portal_detail_error_title()}</p>
          <p className="mt-1 text-sm text-mrp-text2">{m.portal_claims_error_description()}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="cursor-pointer rounded-[10px] border border-mrp-border2 bg-mrp-raised px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.08em] transition-colors hover:border-mrp-red hover:text-mrp-redh"
            >
              {m.portal_claims_error_retry()}
            </button>
            <Link
              to="/claims"
              className="text-[13px] font-bold uppercase tracking-[0.08em] text-mrp-redh hover:underline"
            >
              {m.portal_detail_back()}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
