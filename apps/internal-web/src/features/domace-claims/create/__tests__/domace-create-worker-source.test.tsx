import {
  departmentsReferenceOptions,
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

// Capture which employee list each section receives. For DOMACE (docs/23) the
// ZAPOSLENI field takes EVERY active worker — the same roster as fault
// attribution — not the assembly-only subset EMOTIVE uses.
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
  // One roster feeds both the ZAPOSLENI field and fault attribution.
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

  it('feeds every active worker to both the ZAPOSLENI field and fault attribution', async () => {
    await renderForm()

    expect(screen.getByTestId('basic-employees')).toHaveTextContent(ASSEMBLY_WORKER.id)
    expect(screen.getByTestId('basic-employees')).toHaveTextContent(BLOCKS_WORKER.id)

    expect(screen.getByTestId('faults-employees')).toHaveTextContent(ASSEMBLY_WORKER.id)
    expect(screen.getByTestId('faults-employees')).toHaveTextContent(BLOCKS_WORKER.id)
  })
})
