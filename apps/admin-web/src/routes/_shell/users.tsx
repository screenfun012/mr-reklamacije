import { usersListOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { UsersPageContent, UsersPageSkeleton } from '~/components/users/users-page'

export const Route = createFileRoute('/_shell/users')({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(usersListOptions())
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
