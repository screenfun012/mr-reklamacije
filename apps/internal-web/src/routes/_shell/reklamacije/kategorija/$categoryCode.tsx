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
import { useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { ClaimsListContent } from '~/features/claims/claims-list-content'
import { resolveClaimsListMode } from '~/features/claims/claims-list-mode'
import { ClaimsRouteError, ClaimsRoutePending } from '~/features/claims/claims-route-states'
import { internalRequireClaimsListView } from '~/lib/auth-guard'

/** The code is the PLACE here — it lives in the path, so it is not a filter in the search. */
const CategorySearchSchema = ClaimsSearchSchema.omit({ categoryCode: true })

export const Route = createFileRoute('/_shell/reklamacije/kategorija/$categoryCode')({
  beforeLoad: internalRequireClaimsListView(),
  validateSearch: (search) => CategorySearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, params: { categoryCode }, deps: search }) => {
    const filters = { ...claimsFiltersFromSearch(search), categoryCode }
    const { page, pageSize } = claimsPaginationFromSearch(search)

    await Promise.all([
      queryClient.ensureQueryData(
        claimsListOptions(filters, page, pageSize, claimsSortFromSearch(search)),
      ),
      queryClient.ensureQueryData(claimCategoryCountsOptions()),
      queryClient.ensureQueryData(engineManufacturersReferenceOptions({ activeOnly: true })),
    ])
  },
  component: KategorijaComponent,
  pendingComponent: ClaimsRoutePending,
  errorComponent: ClaimsRouteError,
})

const rootRoute = getRouteApi('__root__')

function KategorijaComponent(): React.ReactElement {
  const { categoryCode } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  const { data: counts } = useSuspenseQuery(claimCategoryCountsOptions())

  const handleSearchChange = useCallback(
    (next: typeof search) => {
      void navigate({ search: next, replace: true })
    },
    [navigate],
  )

  const handleLeaveCategory = useCallback(
    (next: typeof search) => {
      // Every other filter travels with you; only the place changes.
      void navigate({ to: '/reklamacije', search: next })
    },
    [navigate],
  )

  return (
    <ClaimsListContent
      search={search}
      onSearchChange={handleSearchChange}
      mode={resolveClaimsListMode(categoryCode, counts.items)}
      canCreateEmotive={permissions.includes('emotive_claims.create')}
      canCreateDomace={permissions.includes('domace_claims.create')}
      onLeaveCategory={handleLeaveCategory}
    />
  )
}
