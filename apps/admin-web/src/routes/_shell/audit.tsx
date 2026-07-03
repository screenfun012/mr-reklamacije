import { auditLogListOptions, usersListOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'

import { AuditPageContent } from '~/components/audit/audit-page'

export const Route = createFileRoute('/_shell/audit')({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureInfiniteQueryData(auditLogListOptions({})),
      queryClient.ensureQueryData(usersListOptions()),
    ])
  },
  component: AuditRoute,
})

function AuditRoute(): React.ReactElement {
  return <AuditPageContent />
}
