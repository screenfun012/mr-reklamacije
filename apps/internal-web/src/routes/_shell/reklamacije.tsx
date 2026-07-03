import { createFileRoute, Outlet } from '@tanstack/react-router'

import { internalRequireClaimsListView } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/reklamacije')({
  beforeLoad: internalRequireClaimsListView(),
  component: Outlet,
})
