import {
  EmotiveClaimsSearchSchema,
  emotiveClaimsFiltersFromSearch,
  emotiveClaimsListOptions,
  emotiveClaimsPaginationFromSearch,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { getRouteApi } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback } from 'react'

import { InternalShell } from '~/components/layout/internal-shell'
import { EmotiveClaimsListContent } from '~/features/emotive-claims/emotive-claims-list-content'
import { EmotiveClaimsTableSkeleton } from '~/features/emotive-claims/emotive-claims-table'
import { internalRequireEmotiveClaimsView } from '~/lib/auth-guard'

export const Route = createFileRoute('/reklamacije')({
  validateSearch: (search) => EmotiveClaimsSearchSchema.parse(search),
  beforeLoad: internalRequireEmotiveClaimsView(),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps: search }) => {
    const filters = emotiveClaimsFiltersFromSearch(search)
    const { page, pageSize } = emotiveClaimsPaginationFromSearch(search)
    await queryClient.ensureQueryData(emotiveClaimsListOptions(filters, page, pageSize))
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{m.nav_reklamacije()}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_page_subtitle()}</p>
          </div>
          {canCreate ? (
            <Button asChild className="gap-2 self-start">
              <Link to="/reklamacije/emotive/nova" search={search}>
                <Plus className="size-4" />
                {m.emotive_claims_new_claim()}
              </Link>
            </Button>
          ) : null}
        </div>
        <EmotiveClaimsListContent search={search} onSearchChange={handleSearchChange} />
      </div>
    </InternalShell>
  )
}

function ReklamacijePending() {
  return (
    <InternalShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{m.nav_reklamacije()}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_page_subtitle()}</p>
        </div>
        <EmotiveClaimsTableSkeleton />
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
