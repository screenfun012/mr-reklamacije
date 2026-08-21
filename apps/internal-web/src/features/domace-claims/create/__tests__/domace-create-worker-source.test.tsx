import {
  assignedWorkerReferenceOptions,
  claimCategoryFieldsForCategoryOptions,
  customersReferenceOptions,
  departmentsReferenceOptions,
  claimCategoriesReferenceOptions,
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
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClaimCreateWizard } from '../../../claims/create/claim-create-wizard.js'

// Capture which employee list each section receives. For DOMACE (docs/23) the
// ZAPOSLENI field takes EVERY active worker — the same roster as fault
// attribution — not the assembly-only subset EMOTIVE uses.
vi.mock('../../../domace-claims/create/domace-basic-fields.js', () => ({
  DomaceBasicFields: ({
    employees,
    form,
  }: {
    employees: EmployeeListItem[]
    form: { setFieldValue: (name: string, value: string) => void }
  }) => (
    <div>
      <div data-testid="basic-employees">{employees.map((e) => e.id).join(',')}</div>
      {/* The real fields are mocked away, so this stands in for filling the buyer's name —
          without it the step's own "at least one of MR / buyer" rule blocks the way forward. */}
      <button type="button" onClick={() => form.setFieldValue('customerName', 'Kupac')}>
        stub-fill
      </button>
    </div>
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

const CATEGORY = {
  id: '99999999-9999-4999-8999-999999999999',
  code: 'REMONT_MOTORA',
  name: 'Generalni remont motora',
  sortOrder: 10,
  isActive: true,
  deactivatedAt: null,
  usageCount: 0,
}

async function renderForm(): Promise<void> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(engineManufacturersReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, [])
  // One roster feeds both the ZAPOSLENI field and fault attribution.
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [
    ASSEMBLY_WORKER,
    BLOCKS_WORKER,
  ])
  client.setQueryData(departmentsReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(externalPartiesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, [CATEGORY])
  client.setQueryData(claimCategoryFieldsForCategoryOptions(CATEGORY.id).queryKey, [])
  // EMOTIVE's assigned worker is assembly-only — kept EMPTY here, so a wizard that fed this list
  // to the DOMAĆA field instead of every active worker would show nothing and fail below.
  client.setQueryData(assignedWorkerReferenceOptions().queryKey, [])
  client.setQueryData(
    customersReferenceOptions({ kind: 'emotive_partner', activeOnly: true }).queryKey,
    [],
  )

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <ClaimCreateWizard
        category={CATEGORY}
        canCreateEmotive={false}
        canCreateDomace
        onLeave={() => undefined}
      />
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

describe("the claim wizard's worker sources", () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('feeds every active worker to both the ZAPOSLENI field and fault attribution', async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.click(screen.getByRole('button', { name: /Domaća firma ili privatno lice/ }))

    expect(screen.getByTestId('basic-employees')).toHaveTextContent(ASSEMBLY_WORKER.id)
    expect(screen.getByTestId('basic-employees')).toHaveTextContent(BLOCKS_WORKER.id)

    await user.click(screen.getByRole('button', { name: 'stub-fill' }))
    await user.click(screen.getByRole('button', { name: 'Dalje' }))

    expect(screen.getByTestId('faults-employees')).toHaveTextContent(ASSEMBLY_WORKER.id)
    expect(screen.getByTestId('faults-employees')).toHaveTextContent(BLOCKS_WORKER.id)
  })
})
