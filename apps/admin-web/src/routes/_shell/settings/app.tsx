import { appSettingsOptions } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { AppSettingsForm } from '~/components/app-settings/app-settings-form'

export const Route = createFileRoute('/_shell/settings/app')({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(appSettingsOptions())
  },
  component: AppSettingsRoute,
})

function AppSettingsRoute(): React.ReactElement {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
      <AppSettingsForm />
    </Suspense>
  )
}
