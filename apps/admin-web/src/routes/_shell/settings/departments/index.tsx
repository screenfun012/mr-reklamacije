import { ResourceCatalogSearchSchema, departmentsReferenceOptions } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { departmentsResourceDefinition } from '~/resources/departments.definition'

export const Route = createFileRoute('/_shell/settings/departments/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(departmentsReferenceOptions({ activeOnly: false }))
  },
  component: DepartmentsRoute,
})

function DepartmentsRoute(): React.ReactElement {
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
        definition={departmentsResourceDefinition}
        search={search}
        onSearchChange={handleSearchChange}
      />
    </Suspense>
  )
}
