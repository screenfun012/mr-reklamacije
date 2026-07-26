import { m, getLocale } from '@mr/i18n'
import {
  IntakeOrdersSearchSchema,
  intakeFiltersFromSearch,
  intakeOrderSummaryOptions,
  intakeOrdersListOptions,
  type IntakeOrdersSearch,
} from '@mr/shared'
import { Heading, ListPagination } from '@mr/ui'
import { createFileRoute, getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Suspense, useCallback, type ReactElement } from 'react'

import { internalButtonClasses } from '~/components/internal-button'
import { IntakeFilterBar } from '~/features/intake-orders/intake-filter-bar'
import { IntakeKpiCards, IntakeKpiCardsSkeleton } from '~/features/intake-orders/intake-kpi-cards'
import {
  IntakeOrdersTable,
  IntakeOrdersTableSkeleton,
} from '~/features/intake-orders/intake-orders-table'

export const Route = createFileRoute('/_shell/prijem/')({
  validateSearch: (search) => IntakeOrdersSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps: search }) => {
    await Promise.all([
      queryClient.ensureQueryData(intakeOrdersListOptions(intakeFiltersFromSearch(search))),
      queryClient.ensureQueryData(intakeOrderSummaryOptions()),
    ])
  },
  component: PrijemListScreen,
  pendingComponent: PrijemPending,
  errorComponent: PrijemError,
})

const rootRoute = getRouteApi('__root__')

/** "SUBOTA · 26.07.2026" — localized, so the shop reads its own weekday. */
function eyebrowDate(locale: string): string {
  const now = new Date()
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now).toUpperCase()
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)
  return `${weekday} · ${date}`
}

function PrijemListScreen(): ReactElement {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  const canCreate = permissions.includes('intake_orders.create')
  /**
   * Only a caller who sees the whole shop gets the "Nedovršeni" filter. A serviser's own
   * drafts are always in his list — it is his unfinished work, and hiding it behind a toggle
   * would mean he could not resume from the list (docs/25 §3.3).
   */
  const seesWholeShop = permissions.includes('intake_orders.view')

  const patchSearch = useCallback(
    (next: Partial<IntakeOrdersSearch>) => {
      void navigate({
        // Any filter change returns to page 1: staying on page 4 of a narrower result set
        // shows an empty table and reads as "nothing found".
        search: (prev: IntakeOrdersSearch) => ({ ...prev, page: undefined, ...next }),
        replace: true,
      })
    },
    [navigate],
  )

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
            {eyebrowDate(getLocale())}
          </span>
          <Heading level="h1">{m.intake_title()}</Heading>
          {/* The prototype states the scope under the title, so nobody has to infer why the
              list is short. Never the word "Kancelarija" — that is not a role (docs/25 §3.1). */}
          <span className="text-[13px] text-mri-text2">
            {seesWholeShop ? m.intake_list_scope_all() : m.intake_list_scope_own()}
          </span>
        </div>

        {canCreate ? (
          <Link
            to="/prijem/novi"
            className={internalButtonClasses('primary', 'h-[52px] w-auto px-6')}
          >
            <Plus className="size-4" aria-hidden="true" />
            {m.intake_new_order()}
          </Link>
        ) : null}
      </header>

      <Suspense fallback={null}>
        <UnfinishedBanner search={search} seesWholeShop={seesWholeShop} />
      </Suspense>

      <Suspense fallback={<IntakeKpiCardsSkeleton />}>
        <KpiSection />
      </Suspense>

      <IntakeFilterBar
        status={search.status}
        search={search.q ?? ''}
        showUnfinishedToggle={seesWholeShop}
        unfinished={search.unfinished === true}
        onStatusChange={(status) => patchSearch({ status })}
        onSearchChange={(value) => patchSearch({ q: value.length > 0 ? value : undefined })}
        onUnfinishedChange={(value) => patchSearch({ unfinished: value ? true : undefined })}
      />

      <Suspense fallback={<IntakeOrdersTableSkeleton />}>
        <TableSection search={search} onPatchSearch={patchSearch} />
      </Suspense>
    </div>
  )
}

/**
 * The amber "you have an unfinished intake" strip above the KPI row (dopuna-2 §2). Read from
 * the list the screen already loaded — a caller scoped to their own orders has their drafts in
 * it, so this costs no extra request. The office does not get the strip: its drafts are other
 * people's, and it reaches them through the "Nedovršeni" filter instead.
 */
function UnfinishedBanner({
  search,
  seesWholeShop,
}: {
  search: IntakeOrdersSearch
  seesWholeShop: boolean
}): ReactElement | null {
  const { data } = useSuspenseQuery(intakeOrdersListOptions(intakeFiltersFromSearch(search)))

  if (seesWholeShop) {
    return null
  }

  const draft = data.items.find((item) => item.signedAt === null)
  if (draft === undefined) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[11px] border border-[rgba(245,166,35,0.26)] bg-[rgba(245,166,35,0.09)] px-4 py-3.5">
      <span className="flex-none font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-mri-warn">
        {m.intake_draft_tag()}
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] text-mri-text">
        {m.intake_draft_list_line({
          number: draft.orderNumber,
          vehicle: draft.vehicle,
          plate: draft.plate,
          step: draft.draftStep ?? 1,
        })}
      </span>
      <Link
        to="/prijem/novi"
        className="h-[42px] flex-none rounded-[9px] border border-[rgba(245,166,35,0.45)] px-[18px] font-mono text-xs font-extrabold uppercase leading-[42px] tracking-[0.08em] text-mri-warn"
      >
        {m.intake_draft_resume()}
      </Link>
    </div>
  )
}

function KpiSection(): ReactElement {
  const { data } = useSuspenseQuery(intakeOrderSummaryOptions())
  return <IntakeKpiCards summary={data} />
}

function TableSection({
  search,
  onPatchSearch,
}: {
  search: IntakeOrdersSearch
  onPatchSearch: (next: Partial<IntakeOrdersSearch>) => void
}): ReactElement {
  const { data } = useSuspenseQuery(intakeOrdersListOptions(intakeFiltersFromSearch(search)))

  return (
    <div className="flex flex-col gap-3">
      <IntakeOrdersTable items={data.items} />
      {/*
        The shop does ~10 intakes a day, so page 1 fills within days. Without a pager the
        office would be locked to the newest page with no way back — the same component the
        claims list uses, so paging behaves identically across the app.
      */}
      <ListPagination
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        onPageChange={(page) => onPatchSearch({ page })}
        onPageSizeChange={(pageSize) => onPatchSearch({ pageSize, page: 1 })}
      />
    </div>
  )
}

function PrijemPending(): ReactElement {
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      <IntakeKpiCardsSkeleton />
      <IntakeOrdersTableSkeleton />
    </div>
  )
}

function PrijemError(): ReactElement {
  return (
    <div className="mx-auto max-w-[1320px] rounded-[12px] border border-mri-bad/40 bg-mri-bad-bg px-4 py-10 text-center">
      <p className="text-mri-bad">{m.intake_list_error()}</p>
    </div>
  )
}
