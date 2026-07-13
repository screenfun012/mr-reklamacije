import { createFileRoute, Outlet } from '@tanstack/react-router'

import { internalRequireClientSubmissionsManage } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/pristiglo')({
  beforeLoad: internalRequireClientSubmissionsManage(),
  component: Outlet,
})
