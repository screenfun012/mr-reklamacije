import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { InternalShell } from '~/components/layout/internal-shell'
import { StatistikaExportSection } from '~/features/statistika/statistika-export-section'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/statistika')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  component: StatistikaComponent,
})

const rootRoute = getRouteApi('__root__')

function StatistikaComponent() {
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  const canExportPartial = permissions.includes('export.workbook_partial')
  const canExportFull = permissions.includes('export.workbook_full')

  return (
    <InternalShell>
      <div className="flex flex-col gap-6">
        <div>
          <Heading level="h1" className="mb-2">
            {m.nav_statistika()}
          </Heading>
          <p className="text-muted-foreground">{m.statistika_subtitle()}</p>
        </div>

        {canExportPartial || canExportFull ? (
          <StatistikaExportSection
            canExportPartial={canExportPartial}
            canExportFull={canExportFull}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{m.statistika_export_no_permission()}</p>
        )}
      </div>
    </InternalShell>
  )
}
