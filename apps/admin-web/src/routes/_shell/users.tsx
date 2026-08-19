import { rolesListOptions, usersListOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { UsersPageContent, UsersPageSkeleton } from '~/components/users/users-page'

export const Route = createFileRoute('/_shell/users')({
  loader: async ({ context: { queryClient } }) => {
    // Both, in parallel. The roles list is what turns a held code into a name in `UserRolesBadges`
    // and fills both assignment dialogs; without it here the server rendered the table with raw
    // codes and the browser fetched them again after hydration — a visible flip and a waterfall.
    await Promise.all([
      queryClient.ensureQueryData(usersListOptions()),
      queryClient.ensureQueryData(rolesListOptions()),
    ])
  },
  component: UsersRoute,
})

function UsersRoute(): React.ReactElement {
  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <UsersPageContent />
    </Suspense>
  )
}
