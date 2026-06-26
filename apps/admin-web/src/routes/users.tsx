import { usersListOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { UsersPageContent, UsersPageSkeleton } from '~/components/users/users-page'
import { adminRequireRoles } from '~/lib/auth-guard'

import { AdminShell } from '~/components/layout/admin-shell'

export const Route = createFileRoute('/users')({
  beforeLoad: adminRequireRoles(['admin']),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(usersListOptions())
  },
  component: UsersRoute,
})

function UsersRoute(): React.ReactElement {
  return (
    <AdminShell>
      <Suspense fallback={<UsersPageSkeleton />}>
        <UsersPageContent />
      </Suspense>
    </AdminShell>
  )
}
