import { auditLogListOptions, usersListOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'

import { AuditPageContent } from '~/components/audit/audit-page'
import { AdminShell } from '~/components/layout/admin-shell'
import { adminRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/audit')({
  beforeLoad: adminRequireRoles(['admin']),
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureInfiniteQueryData(auditLogListOptions({})),
      queryClient.ensureQueryData(usersListOptions()),
    ])
  },
  component: AuditRoute,
})

function AuditRoute(): React.ReactElement {
  return (
    <AdminShell>
      <AuditPageContent />
    </AdminShell>
  )
}
