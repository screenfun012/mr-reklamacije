import { ResourceCatalogSearchSchema, externalPartiesReferenceOptions } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { externalPartiesResourceDefinition } from '~/resources/external-parties.definition'

export const Route = createFileRoute('/_shell/settings/external-parties/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(externalPartiesReferenceOptions({ activeOnly: false }))
  },
  component: ExternalPartiesRoute,
})

function ExternalPartiesRoute(): React.ReactElement {
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
        definition={externalPartiesResourceDefinition}
        search={search}
        onSearchChange={handleSearchChange}
      />
    </Suspense>
  )
}
