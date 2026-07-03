import { ResourceCatalogSearchSchema, claimSourcesReferenceOptions } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { claimSourcesResourceDefinition } from '~/resources/claim-sources.definition'

export const Route = createFileRoute('/_shell/settings/claim-sources/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(claimSourcesReferenceOptions({ activeOnly: false }))
  },
  component: ClaimSourcesRoute,
})

function ClaimSourcesRoute(): React.ReactElement {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

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
    <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
      <ResourceListPage
        definition={claimSourcesResourceDefinition}
        search={search}
        onSearchChange={handleSearchChange}
      />
    </Suspense>
  )
}
