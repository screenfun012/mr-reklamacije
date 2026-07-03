import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/pristiglo')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  component: PristigloComponent,
})

function PristigloComponent() {
  return (
    <div>
      <Heading level="h1" className="mb-2">
        {m.nav_pristiglo()}
      </Heading>
      <p className="text-muted-foreground">{m.placeholder_coming_soon_phase()}</p>
    </div>
  )
}
