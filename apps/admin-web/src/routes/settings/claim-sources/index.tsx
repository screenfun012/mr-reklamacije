import { ResourceCatalogSearchSchema, claimSourcesReferenceOptions } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { AdminShell } from '~/components/layout/admin-shell'
import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { adminRequireRoles } from '~/lib/auth-guard'
import { claimSourcesResourceDefinition } from '~/resources/claim-sources.definition'

export const Route = createFileRoute('/settings/claim-sources/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  beforeLoad: adminRequireRoles(['admin']),
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
    <AdminShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
        <ResourceListPage
          definition={claimSourcesResourceDefinition}
          search={search}
          onSearchChange={handleSearchChange}
        />
      </Suspense>
    </AdminShell>
  )
}
