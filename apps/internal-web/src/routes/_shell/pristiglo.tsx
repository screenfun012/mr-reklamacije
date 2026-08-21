import { m } from '@mr/i18n'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { internalRequireClientSubmissionsManage } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/pristiglo')({
  beforeLoad: internalRequireClientSubmissionsManage(),
  staticData: { crumb: m.nav_pristiglo },
  component: Outlet,
})
