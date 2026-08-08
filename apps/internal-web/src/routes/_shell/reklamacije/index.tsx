import {
  ClaimsSearchSchema,
  claimsFiltersFromSearch,
  claimsListOptions,
  claimsPaginationFromSearch,
  claimsSortFromSearch,
  engineManufacturersReferenceOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'
import { createFileRoute, getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import { internalButtonClasses } from '~/components/internal-button'
import { internalRequireRoles } from '~/lib/auth-guard'
import { ClaimsListContent } from '~/features/claims/claims-list-content'
import { ClaimsTableSkeleton } from '~/features/claims/claims-table'
import { pageSizeToRestore, readRememberedPageSize } from '~/features/claims/remembered-page-size'

export const Route = createFileRoute('/_shell/reklamacije/')({
  // Internal app is for employees + viewers; a client session (possible in dev
  // via shared localhost cookies) must bounce to login, not error-boundary.
  beforeLoad: internalRequireRoles(['operator', 'viewer', 'admin']),
  validateSearch: (search) => ClaimsSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps: search }) => {
    const filters = claimsFiltersFromSearch(search)
    const { page, pageSize } = claimsPaginationFromSearch(search)
    const sort = claimsSortFromSearch(search)
    await Promise.all([
      queryClient.ensureQueryData(claimsListOptions(filters, page, pageSize, sort)),
      queryClient.ensureQueryData(engineManufacturersReferenceOptions({ activeOnly: true })),
    ])
  },
  component: ReklamacijeComponent,
  pendingComponent: ReklamacijePending,
  errorComponent: ReklamacijeError,
})

const rootRoute = getRouteApi('__root__')

function ReklamacijeComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { authSession } = rootRoute.useRouteContext()
  const canCreate = authSession?.user?.permissions.includes('emotive_claims.create') === true
  const canCreateDomace = authSession?.user?.permissions.includes('domace_claims.create') === true

  const handleSearchChange = useCallback(
    (next: typeof search) => {
      void navigate({
        search: next,
        replace: true,
      })
    },
    [navigate],
  )

  // Restore the user's personal page-size preference on a fresh landing (once),
  // unless the URL explicitly set one. Runs client-side only (localStorage).
  const restoredPageSize = useRef(false)
  useEffect(() => {
    if (restoredPageSize.current) {
      return
    }
    restoredPageSize.current = true
    const urlHasPageSize = new URLSearchParams(window.location.search).has('pageSize')
    const target = pageSizeToRestore(urlHasPageSize, readRememberedPageSize(), search.pageSize)
    if (target !== null) {
      void navigate({
        search: (prev) => ({ ...prev, page: 1, pageSize: target }),
        replace: true,
      })
    }
  }, [navigate, search.pageSize])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading level="h1">{m.nav_reklamacije()}</Heading>
          <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_page_subtitle()}</p>
        </div>
        <div className="flex flex-wrap gap-2.5 self-start">
          {canCreate ? (
            <Link
              to="/reklamacije/emotive/nova"
              className={internalButtonClasses(
                'primary',
                'h-[46px] w-auto px-[22px] text-[12.5px]',
              )}
            >
              <Plus className="size-4" aria-hidden="true" />
              {m.emotive_claims_new_claim()}
            </Link>
          ) : null}
          {canCreateDomace ? (
            <Link
              to="/reklamacije/domace/nova"
              className={internalButtonClasses(
                'outline',
                'h-[46px] w-auto px-[22px] text-[12.5px]',
              )}
            >
              <Plus className="size-4" aria-hidden="true" />
              {m.domace_claims_new_claim()}
            </Link>
          ) : null}
        </div>
      </div>
      <ClaimsListContent search={search} onSearchChange={handleSearchChange} />
    </div>
  )
}

function ReklamacijePending() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Heading level="h1">{m.nav_reklamacije()}</Heading>
        <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_page_subtitle()}</p>
      </div>
      <ClaimsTableSkeleton />
    </div>
  )
}

function ReklamacijeError() {
  // Not the `reset` the router offers an errorComponent: it clears the catch boundary, the errored
  // match re-throws, and no request goes out. `invalidate()` is what re-runs the loader.
  const router = useRouter()

  return (
    <div
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
      role="alert"
    >
      <p className="text-sm font-medium text-foreground">{m.emotive_claims_error_title()}</p>
      <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_error_description()}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={() => {
          void router.invalidate()
        }}
      >
        {m.emotive_claims_error_retry()}
      </Button>
    </div>
  )
}
