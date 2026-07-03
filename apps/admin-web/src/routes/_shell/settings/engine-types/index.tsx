import {
  engineManufacturersReferenceOptions,
  engineTypesReferenceOptions,
  ResourceCatalogSearchSchema,
} from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { engineTypesResourceDefinition } from '~/resources/engine-types.definition'

export const Route = createFileRoute('/_shell/settings/engine-types/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(engineTypesReferenceOptions({ activeOnly: false })),
      queryClient.ensureQueryData(engineManufacturersReferenceOptions({ activeOnly: false })),
    ])
  },
  component: EngineTypesRoute,
})

function EngineTypesRoute(): React.ReactElement {
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
        definition={engineTypesResourceDefinition}
        search={search}
        onSearchChange={handleSearchChange}
      />
    </Suspense>
  )
}
