import { usePermissions } from '@mr/auth/route-guards'
import { permissionCatalogOptions, rolesListOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { RolesScreen } from '~/components/roles/roles-screen'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/_shell/settings/roles/')({
  loader: async ({ context: { queryClient } }) => {
    // The catalog is fetched here too: the editor opens into it, and waiting for 84 rows after the
    // click is the difference between a dialog and a spinner.
    await Promise.all([
      queryClient.ensureQueryData(rolesListOptions()),
      queryClient.ensureQueryData(permissionCatalogOptions()),
    ])
  },
  component: RolesRoute,
})

function RolesRoute(): React.ReactElement {
  // What the signed-in actor holds, for "you cannot hand out what you do not hold". Today every
  // actor here is an admin and therefore holds everything, so no checkbox is ever dead — the rule
  // is built for the day some of this is delegated, and the server decides either way.
  const { list } = usePermissions(authClient)

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
      <RolesScreen heldPermissions={list} />
    </Suspense>
  )
}
