import { createFileRoute, Outlet } from '@tanstack/react-router'

import { internalRequireEmotiveClaimsView } from '~/lib/auth-guard'

export const Route = createFileRoute('/reklamacije')({
  beforeLoad: internalRequireEmotiveClaimsView(),
  component: Outlet,
})
