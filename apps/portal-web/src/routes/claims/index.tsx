import { useState } from 'react'

import { m } from '@mr/i18n'
import {
  clientClaimsListOptions,
  clientPortalSummaryOptions,
  CLIENT_CLAIMS_PAGE_SIZE,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { MaskedIcon } from '~/components/masked-icon'
import { PortalHeader } from '~/components/portal-header'
import { PortalPagination } from '~/components/portal-pagination'
import { ClaimCard } from '~/features/claims/claim-card'
import { ActivityCard, DashboardStats, SupportCard } from '~/features/claims/dashboard-cards'
import { DashboardSkeleton } from '~/features/claims/dashboard-skeleton'
import { authClient } from '~/lib/auth-client'
import { useLocale } from '@mr/ui'
import { formatPortalDateEyebrow } from '~/lib/portal-format'

const dashboardSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/claims/')({
  validateSearch: (search) => dashboardSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context: { queryClient }, deps }) => {
    await Promise.all([
      queryClient.ensureQueryData(clientClaimsListOptions(deps.page)),
      queryClient.ensureQueryData(clientPortalSummaryOptions()),
    ])
  },
  component: DashboardComponent,
  pendingComponent: DashboardSkeleton,
  errorComponent: DashboardError,
})

const dashboardRoute = getRouteApi('/claims/')

type ServiceFilter = 'all' | 'engine' | 'machining'

const FILTERS: { key: ServiceFilter; label: () => string }[] = [
  { key: 'all', label: () => m.portal_filter_all() },
  { key: 'engine', label: () => m.portal_filter_engine() },
  { key: 'machining', label: () => m.portal_filter_machining() },
]

function DashboardBackdrop() {
  return (
    <>
      <div className="mrp-grid-bg mrp-grid-fade-down absolute inset-0" />
      <div className="absolute -top-[260px] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(237,28,36,0.1),transparent_65%)]" />
      <span
        className="absolute -right-[170px] top-[70px] size-[460px] text-mrp-gear"
        style={{ animation: 'mrpSpin 130s linear infinite' }}
      >
        <MaskedIcon name="cog" className="size-full" />
      </span>
    </>
  )
}

function DashboardComponent() {
  const navigate = useNavigate()
  const { locale } = useLocale()
  const { page } = dashboardRoute.useLoaderDeps()
  const { data: session } = authClient.useSession()
  const { data: list } = useSuspenseQuery(clientClaimsListOptions(page))
  const { data: summary } = useSuspenseQuery(clientPortalSummaryOptions())
  const [filter, setFilter] = useState<ServiceFilter>('all')
  // One stable timestamp per mount for the eyebrow + relative feed times.
  const [now] = useState(() => new Date())

  const company = list.items[0]?.customerName ?? session?.user.name ?? ''
  // All claims are engine remanufacture until machining claims exist in the
  // internal app — the machining tab is prepared UI with an honest empty state.
  const claims = filter === 'machining' ? [] : list.items
  const totalPages = Math.max(1, Math.ceil(list.total / CLIENT_CLAIMS_PAGE_SIZE))

  return (
    <div className="relative min-h-screen overflow-hidden bg-mrp-bg">
      <DashboardBackdrop />
      <PortalHeader company={company} />

      <div className="relative mx-auto max-w-[1280px] px-5 pb-[72px] pt-10 sm:px-8">
        <div className="mb-[34px] flex flex-wrap items-end justify-between gap-8">
          <div className="mrp-fade-up">
            <div className="mb-2.5 font-mono text-[11px] font-medium tracking-[0.2em] text-mrp-redh">
              {formatPortalDateEyebrow(now, locale)}
            </div>
            <h1 className="mb-2 text-[30px] font-extrabold tracking-[-0.02em] sm:text-[38px]">
              {m.portal_dashboard_greeting({ company })}
            </h1>
            <p className="text-[15px] text-mrp-text2">
              {m.portal_dashboard_summary({
                resolved: summary.stats.resolved,
                total: summary.stats.total,
                inWorkshop: summary.stats.inProgress,
              })}
            </p>
          </div>
          <DashboardStats stats={summary.stats} />
        </div>

        <div className="grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[minmax(0,1fr)_330px]">
          <div>
            <div
              className="mrp-fade-up mb-[18px] flex flex-wrap items-center justify-between gap-4"
              style={{ animationDelay: '0.15s' }}
            >
              <div className="flex items-baseline gap-3">
                <h2 className="text-[21px] font-extrabold tracking-[-0.01em]">
                  {m.portal_claims_heading()}
                </h2>
                <span className="font-mono text-[11.5px] text-mrp-text2">
                  {String(list.total).padStart(2, '0')}
                </span>
              </div>
              <div className="flex overflow-hidden rounded-[9px] border border-mrp-border2">
                {FILTERS.map((f, index) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'cursor-pointer px-[15px] py-2 font-sans text-xs font-semibold transition-colors',
                      index > 0 && 'border-l border-mrp-border',
                      filter === f.key
                        ? 'bg-mrp-red text-white'
                        : 'bg-transparent text-mrp-text2 hover:text-mrp-text',
                    )}
                  >
                    {f.label()}
                  </button>
                ))}
              </div>
            </div>

            {claims.length === 0 ? (
              <div className="rounded-[14px] border border-mrp-border bg-mrp-surface px-6 py-14 text-center text-[14px] text-mrp-text2">
                {filter === 'machining'
                  ? m.portal_claims_empty_machining()
                  : m.portal_claims_empty_description()}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {claims.map((claim, index) => (
                  <ClaimCard key={claim.id} claim={claim} index={index} />
                ))}
              </div>
            )}

            {filter !== 'machining' && (
              <PortalPagination
                page={page}
                totalPages={totalPages}
                onPageChange={(nextPage) => {
                  void navigate({
                    to: '/claims',
                    search: nextPage === 1 ? {} : { page: nextPage },
                  })
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-5">
            <ActivityCard activity={summary.activity} now={now} />
            <SupportCard
              title={m.portal_support_heading()}
              name={m.portal_support_team()}
              initials="MR"
              withTopHairline
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="relative min-h-screen bg-mrp-bg">
      <div className="mx-auto max-w-[1280px] px-8 pt-24">
        <div
          role="alert"
          className="rounded-[14px] border border-[rgba(217,45,32,0.36)] bg-mrp-bad-bg px-6 py-16 text-center"
        >
          <p className="text-sm font-semibold">{m.portal_claims_error_title()}</p>
          <p className="mt-1 text-sm text-mrp-text2">{m.portal_claims_error_description()}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 cursor-pointer rounded-[10px] border border-mrp-border2 bg-mrp-raised px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.08em] transition-colors hover:border-mrp-red hover:text-mrp-redh"
          >
            {m.portal_claims_error_retry()}
          </button>
        </div>
      </div>
    </div>
  )
}
