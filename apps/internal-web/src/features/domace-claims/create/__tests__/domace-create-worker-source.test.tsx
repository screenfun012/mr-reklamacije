import {
  departmentsReferenceOptions,
  assignedWorkerReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  externalPartiesReferenceOptions,
  type EmployeeListItem,
} from '@mr/shared'
import { setLocale } from '@mr/i18n'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DomaceClaimCreateForm } from '../domace-claim-create-form.js'

// Capture which employee list each section receives — the whole point of the fix
// is that the assigned-worker field gets assembly-only while fault attribution
// gets EVERY worker. Collapsing them back to one query would break this test.
vi.mock('../domace-basic-fields.js', () => ({
  DomaceBasicFields: ({ employees }: { employees: EmployeeListItem[] }) => (
    <div data-testid="basic-employees">{employees.map((e) => e.id).join(',')}</div>
  ),
}))
vi.mock('../../../emotive-claims/create/step-faults-fields.js', () => ({
  StepFaultsFields: ({ employees }: { employees: EmployeeListItem[] }) => (
    <div data-testid="faults-employees">{employees.map((e) => e.id).join(',')}</div>
  ),
}))

const ASSEMBLY_WORKER: EmployeeListItem = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  fullName: 'Sklapko',
  departmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  departmentName: 'Sklapanje',
  isActive: true,
  usageCount: 0,
}
const BLOCKS_WORKER: EmployeeListItem = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  fullName: 'Blokan',
  departmentId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  departmentName: 'Blokovi',
  isActive: true,
  usageCount: 0,
}

async function renderForm(): Promise<void> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(engineManufacturersReferenceOptions({ activeOnly: true }).queryKey, [])
  // Assembly-only list for the assigned worker; the full roster for fault attribution.
  client.setQueryData(assignedWorkerReferenceOptions().queryKey, [ASSEMBLY_WORKER])
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [
    ASSEMBLY_WORKER,
    BLOCKS_WORKER,
  ])
  client.setQueryData(departmentsReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(externalPartiesReferenceOptions({ activeOnly: true }).queryKey, [])

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <DomaceClaimCreateForm />
    </QueryClientProvider>
  )
  const rootRoute = createRootRoute({ component: () => node })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/domace/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/reklamacije/domace/nova'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

describe('DomaceClaimCreateForm worker sources', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('feeds the assigned-worker field assembly only, and fault attribution every worker', async () => {
    await renderForm()

    expect(screen.getByTestId('basic-employees')).toHaveTextContent(ASSEMBLY_WORKER.id)
    expect(screen.getByTestId('basic-employees')).not.toHaveTextContent(BLOCKS_WORKER.id)

    expect(screen.getByTestId('faults-employees')).toHaveTextContent(ASSEMBLY_WORKER.id)
    expect(screen.getByTestId('faults-employees')).toHaveTextContent(BLOCKS_WORKER.id)
  })
})
