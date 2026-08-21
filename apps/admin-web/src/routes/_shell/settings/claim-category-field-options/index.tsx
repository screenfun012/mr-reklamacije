import { ResourceCatalogSearchSchema, claimCategoryFieldOptionsReferenceOptions } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { claimCategoryFieldOptionsResourceDefinition } from '~/resources/claim-category-field-options.definition'

export const Route = createFileRoute('/_shell/settings/claim-category-field-options/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      claimCategoryFieldOptionsReferenceOptions({ activeOnly: false }),
    )
  },
  component: ClaimCategoryFieldOptionsRoute,
})

function ClaimCategoryFieldOptionsRoute(): React.ReactElement {
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
        definition={claimCategoryFieldOptionsResourceDefinition}
        search={search}
        onSearchChange={handleSearchChange}
      />
    </Suspense>
  )
}
