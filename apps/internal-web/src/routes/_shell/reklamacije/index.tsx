import {
  ClaimsSearchSchema,
  claimCategoryCountsOptions,
  claimsFiltersFromSearch,
  claimsListOptions,
  claimsPaginationFromSearch,
  claimsSortFromSearch,
  engineManufacturersReferenceOptions,
} from '@mr/shared'
import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'
import { z } from 'zod'
import { useCallback, useEffect, useRef } from 'react'

import { ClaimsListContent } from '~/features/claims/claims-list-content'
import { ClaimsRouteError, ClaimsRoutePending } from '~/features/claims/claims-route-states'
import { pageSizeToRestore, readRememberedPageSize } from '~/features/claims/remembered-page-size'

export const Route = createFileRoute('/_shell/reklamacije/')({
  // Internal app is for employees + viewers; a client session (possible in dev
  // via shared localhost cookies) must bounce to login, not error-boundary.
  // `SearchSchemaInput` is the router's way of saying "a link may omit what has a default":
  // without it every `<Link>` to this route would have to repeat page and pageSize.
  validateSearch: (search: z.input<typeof ClaimsSearchSchema> & SearchSchemaInput) =>
    ClaimsSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps: search }) => {
    const filters = claimsFiltersFromSearch(search)
    const { page, pageSize } = claimsPaginationFromSearch(search)
    const sort = claimsSortFromSearch(search)
    await Promise.all([
      queryClient.ensureQueryData(claimsListOptions(filters, page, pageSize, sort)),
      queryClient.ensureQueryData(claimCategoryCountsOptions()),
      queryClient.ensureQueryData(engineManufacturersReferenceOptions({ activeOnly: true })),
    ])
  },
  component: ReklamacijeComponent,
  pendingComponent: ClaimsRoutePending,
  errorComponent: ClaimsRouteError,
})

const rootRoute = getRouteApi('__root__')

function ReklamacijeComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []

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
    <ClaimsListContent
      search={search}
      onSearchChange={handleSearchChange}
      mode={{ kind: 'all' }}
      canCreateEmotive={permissions.includes('emotive_claims.create')}
      canCreateDomace={permissions.includes('domace_claims.create')}
      // Never called in this mode — there is no category to leave.
      onLeaveCategory={handleSearchChange}
    />
  )
}
