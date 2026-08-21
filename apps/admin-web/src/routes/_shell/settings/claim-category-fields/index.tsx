import { ResourceCatalogSearchSchema, claimCategoryFieldsReferenceOptions } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { claimCategoryFieldsResourceDefinition } from '~/resources/claim-category-fields.definition'

export const Route = createFileRoute('/_shell/settings/claim-category-fields/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(claimCategoryFieldsReferenceOptions({ activeOnly: false }))
  },
  component: ClaimCategoryFieldsRoute,
})

function ClaimCategoryFieldsRoute(): React.ReactElement {
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
        definition={claimCategoryFieldsResourceDefinition}
        search={search}
        onSearchChange={handleSearchChange}
      />
    </Suspense>
  )
}
