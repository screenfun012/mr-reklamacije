import {
  ClaimsSearchSchema,
  claimsFiltersFromSearch,
  claimsListOptions,
  claimsPaginationFromSearch,
  prefetchClaimEditReferences,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'
import { createFileRoute, getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback } from 'react'

import { InternalShell } from '~/components/layout/internal-shell'
import { ClaimsListContent } from '~/features/claims/claims-list-content'
import { ClaimsTableSkeleton } from '~/features/claims/claims-table'

export const Route = createFileRoute('/reklamacije/')({
  validateSearch: (search) => ClaimsSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps: search }) => {
    const filters = claimsFiltersFromSearch(search)
    const { page, pageSize } = claimsPaginationFromSearch(search)
    await Promise.all([
      queryClient.ensureQueryData(claimsListOptions(filters, page, pageSize)),
      prefetchClaimEditReferences(queryClient),
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

  return (
    <InternalShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Heading level="h1">{m.nav_reklamacije()}</Heading>
            <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_page_subtitle()}</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            {canCreate ? (
              <Button asChild className="gap-2">
                <Link to="/reklamacije/emotive/nova">
                  <Plus className="size-4" />
                  {m.emotive_claims_new_claim()}
                </Link>
              </Button>
            ) : null}
            {canCreateDomace ? (
              <Button asChild variant="outline" className="gap-2">
                <Link to="/reklamacije/domace/nova">
                  <Plus className="size-4" />
                  {m.domace_claims_new_claim()}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <ClaimsListContent search={search} onSearchChange={handleSearchChange} />
      </div>
    </InternalShell>
  )
}

function ReklamacijePending() {
  return (
    <InternalShell>
      <div className="flex flex-col gap-6">
        <div>
          <Heading level="h1">{m.nav_reklamacije()}</Heading>
          <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_page_subtitle()}</p>
        </div>
        <ClaimsTableSkeleton />
      </div>
    </InternalShell>
  )
}

function ReklamacijeError({ reset }: { reset: () => void }) {
  return (
    <InternalShell>
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">{m.emotive_claims_error_title()}</p>
        <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_error_description()}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={reset}>
          {m.emotive_claims_error_retry()}
        </Button>
      </div>
    </InternalShell>
  )
}
