import { engineTypesReferenceOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { AdminShell } from '~/components/layout/admin-shell'
import { ResourceListPage } from '~/lib/resource/resource-list-page'
import { adminRequireRoles } from '~/lib/auth-guard'
import { engineTypesResourceDefinition } from '~/resources/engine-types.definition'

export const Route = createFileRoute('/settings/engine-types/')({
  beforeLoad: adminRequireRoles(['admin']),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(engineTypesReferenceOptions({ activeOnly: false }))
  },
  component: EngineTypesRoute,
})

function EngineTypesRoute(): React.ReactElement {
  return (
    <AdminShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
        <ResourceListPage definition={engineTypesResourceDefinition} />
      </Suspense>
    </AdminShell>
  )
}
