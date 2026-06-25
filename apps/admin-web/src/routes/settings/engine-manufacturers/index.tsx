import { engineManufacturersReferenceOptions, ResourceCatalogSearchSchema } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { AdminShell } from '~/components/layout/admin-shell'
import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { adminRequireRoles } from '~/lib/auth-guard'
import { engineManufacturersResourceDefinition } from '~/resources/engine-manufacturers.definition'

export const Route = createFileRoute('/settings/engine-manufacturers/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  beforeLoad: adminRequireRoles(['admin']),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(engineManufacturersReferenceOptions({ activeOnly: false }))
  },
  component: EngineManufacturersRoute,
})

function EngineManufacturersRoute(): React.ReactElement {
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
    <AdminShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
        <ResourceListPage
          definition={engineManufacturersResourceDefinition}
          search={search}
          onSearchChange={handleSearchChange}
        />
      </Suspense>
    </AdminShell>
  )
}
