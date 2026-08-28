import { useEffect } from 'react'

import { m } from '@mr/i18n'
import {
  attachmentsListOptions,
  ClaimKind,
  clientClaimKeys,
  clientEmotiveClaimDetailOptions,
  clientPortalSummaryOptions,
  fetchNoContent,
} from '@mr/shared'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import { PortalHeader } from '~/components/portal-header'
import { StatusChip } from '~/components/status-chip'
import {
  BasicsCard,
  InspectionCard,
  ReportedProblemCard,
} from '~/features/claims/claim-detail-cards'
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
    // Prefetch (never throws) so photos are cached before first paint, and so a
    // deep-linked detail paints the firm in the header instead of swapping it in.
    await queryClient.prefetchQuery(attachmentsListOptions(ClaimKind.Emotive, params.id))
    await queryClient.prefetchQuery(clientPortalSummaryOptions())
  },
  component: ClaimDetailComponent,
  pendingComponent: DashboardSkeleton,
  errorComponent: ClaimDetailError,
})

const detailRoute = getRouteApi('/claims/$id')

function ClaimDetailComponent() {
  const { id } = detailRoute.useParams()
  const { data: claim } = useSuspenseQuery(clientEmotiveClaimDetailOptions(id))
  // Warmed by the route loader; carries the support contact the admin panel sets.
  const { data: summary } = useSuspenseQuery(clientPortalSummaryOptions())
  const queryClient = useQueryClient()

  const { mutate: markSeen } = useMutation({
    mutationFn: (claimId: string) =>
      fetchNoContent(`/api/emotive-claims/${claimId}/mark-seen`, { method: 'POST' }),
    onSuccess: () => {
      // Clears the dashboard's NEW/UPDATE badge for this claim. The current
      // detail(id) is deliberately NOT invalidated — the "Novo" section
      // markers the client is looking at right now must keep showing for
      // this visit; they clear on the NEXT open via the unmount cache-drop below.
      void queryClient.invalidateQueries({ queryKey: clientClaimKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: clientClaimKeys.summary() })
    },
    onError: (error) => {
      // Best-effort: a failed mark-seen just leaves the badge until the next
      // successful open — it must never break the page.
      console.error('[claim-detail] mark-seen failed:', error)
    },
  })

  // Records that the client actually opened this claim (not just hover-
  // prefetched it — the route loader never calls this, only mount does).
  // Fires once per opened id.
  useEffect(() => {
    markSeen(id)
  }, [id, markSeen])

  // Drop the cached detail on leaving so re-entry refetches fresh
  // `sectionFreshness` against the view just recorded by mark-seen. With a
  // normal staleTime this is the ONLY way re-entry sees fresh markers — and
  // because the data stays fresh for the rest of THIS visit, mounting never
  // triggers a background refetch that could race the mark-seen POST above.
  useEffect(
    () => () => {
      queryClient.removeQueries({ queryKey: clientClaimKeys.detail(id) })
    },
    [queryClient, id],
  )

  const chip = statusChipConfig(claim)
  const service = claimServiceType(claim)
  const claimLabel = formatPortalClaimId(claim.mrNumber, claim.claimNumber)
  const technicianName = claim.employeeName

  return (
    <div className="relative min-h-screen overflow-hidden bg-mrp-bg">
      <div
        className="mrp-grid-bg absolute inset-0"
        style={{
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 45%)',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 45%)',
        }}
      />
      <PortalHeader maxWidthClass="max-w-[1120px]" />

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
        {service !== null && (
          <span
            className="mrp-fade-up mb-[30px] inline-block rounded-md border border-mrp-border2 px-[11px] py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mrp-text2"
            style={{ animationDelay: '0.08s' }}
          >
            {serviceTypeLabel(service)}
          </span>
        )}

        <TimelineCard claim={claim} />

        <div className="grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-[26px]">
            <BasicsCard claim={claim} />
            <ReportedProblemCard claim={claim} />
            <InspectionCard claim={claim} />
            <PhotosCard claimId={claim.id} isFresh={claim.sectionFreshness.photos} />
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
              email={summary.support.email}
              phone={summary.support.phone}
              delay="0.28s"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ClaimDetailError() {
  // Not the `reset` the router offers an errorComponent: it clears the catch boundary, the errored
  // match re-throws, and no request goes out. `invalidate()` is what re-runs the loader.
  const router = useRouter()

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
              onClick={() => {
                void router.invalidate()
              }}
              className="cursor-pointer rounded-[10px] border border-mrp-border2 bg-mrp-raised px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.08em] transition-[color,border-color,transform] hover:border-mrp-red hover:text-mrp-redh active:scale-[0.98]"
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
