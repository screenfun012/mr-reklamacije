import {
  ResourceCatalogSearchSchema,
  departmentsReferenceOptions,
  employeesReferenceOptions,
} from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { employeesResourceDefinition } from '~/resources/employees.definition'

export const Route = createFileRoute('/_shell/settings/employees/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(employeesReferenceOptions({ activeOnly: false })),
      queryClient.ensureQueryData(departmentsReferenceOptions({ activeOnly: true })),
    ])
  },
  component: EmployeesRoute,
})

function EmployeesRoute(): React.ReactElement {
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
        definition={employeesResourceDefinition}
        search={search}
        onSearchChange={handleSearchChange}
      />
    </Suspense>
  )
}
