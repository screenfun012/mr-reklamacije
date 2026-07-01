import { createFileRoute, redirect } from '@tanstack/react-router'

import { portalRequireRoles } from '~/lib/auth-guard'

const requireClient = portalRequireRoles(['client', 'admin'])

// The portal's real home is the claims list; "/" just guards the role and
// forwards there. First-entry welcome is gated at login, not here.
export const Route = createFileRoute('/')({
  beforeLoad: async (ctx) => {
    await requireClient(ctx)
    throw redirect({ to: '/claims' })
  },
})
