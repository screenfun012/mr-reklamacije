import { ResourceCatalogSearchSchema, externalPartiesReferenceOptions } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { AdminShell } from '~/components/layout/admin-shell'
import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { adminRequireRoles } from '~/lib/auth-guard'
import { externalPartiesResourceDefinition } from '~/resources/external-parties.definition'

export const Route = createFileRoute('/settings/external-parties/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  beforeLoad: adminRequireRoles(['admin']),
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
    <AdminShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
        <ResourceListPage
          definition={externalPartiesResourceDefinition}
          search={search}
          onSearchChange={handleSearchChange}
        />
      </Suspense>
    </AdminShell>
  )
}
