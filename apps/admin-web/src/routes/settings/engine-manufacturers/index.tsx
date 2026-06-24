import { engineManufacturersReferenceOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { AdminShell } from '~/components/layout/admin-shell'
import { EngineManufacturersPage } from '~/features/engine-manufacturers/engine-manufacturers-page'
import { adminRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/settings/engine-manufacturers/')({
  beforeLoad: adminRequireRoles(['admin']),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(engineManufacturersReferenceOptions({ activeOnly: false }))
  },
  component: EngineManufacturersRoute,
})

function EngineManufacturersRoute(): React.ReactElement {
  return (
    <AdminShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
        <EngineManufacturersPage />
      </Suspense>
    </AdminShell>
  )
}
