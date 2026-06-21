import { createFileRoute, Outlet } from '@tanstack/react-router'

import { internalRequireClaimsListView } from '~/lib/auth-guard'

export const Route = createFileRoute('/reklamacije')({
  beforeLoad: internalRequireClaimsListView(),
  component: Outlet,
})
