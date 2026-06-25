import { CustomerKind, customersReferenceOptions, ResourceCatalogSearchSchema } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { AdminShell } from '~/components/layout/admin-shell'
import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { adminRequireRoles } from '~/lib/auth-guard'
import { customersResourceDefinition } from '~/resources/customers.definition'

export const Route = createFileRoute('/settings/customers/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  beforeLoad: adminRequireRoles(['admin']),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: false }),
    )
  },
  component: CustomersRoute,
})

function CustomersRoute(): React.ReactElement {
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
          definition={customersResourceDefinition}
          search={search}
          onSearchChange={handleSearchChange}
        />
      </Suspense>
    </AdminShell>
  )
}
