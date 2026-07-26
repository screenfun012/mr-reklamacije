import { createFileRoute, Outlet } from '@tanstack/react-router'

import { internalRequireIntakeOrdersView } from '~/lib/auth-guard'

/**
 * Vehicle service intake (docs/25). Gated on permissions, not roles: a serviser holds no
 * claims access, so the role list the claims routes use would lock him out of the only
 * screen he exists for.
 */
export const Route = createFileRoute('/_shell/prijem')({
  beforeLoad: internalRequireIntakeOrdersView(),
  component: Outlet,
})
