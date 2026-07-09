import {
  departmentsReferenceOptions,
  employeesReferenceOptions,
  externalPartiesReferenceOptions,
  FaultType,
  type DepartmentListItem,
  type EmployeeListItem,
  type EmotiveClaimDetail,
  type ExternalPartyListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EmotiveClaimFaultsSection } from '../emotive-claim-faults-section.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

const DEPARTMENT_ID = '22222222-2222-4222-8222-222222222222'
const FAULT_ID = '33333333-3333-4333-8333-333333333333'

const DEPARTMENTS: DepartmentListItem[] = [
  {
    id: DEPARTMENT_ID,
    code: 'GLAVE',
    nameSr: 'Glave',
    nameEn: 'Heads',
    sortOrder: 1,
    isActive: true,
  },
]
const EMPLOYEES: EmployeeListItem[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    fullName: 'Ana Anić',
    departmentId: DEPARTMENT_ID,
    departmentName: 'Odeljenje',
    isActive: true,
    usageCount: 0,
  },
]
const EXTERNAL_PARTIES: ExternalPartyListItem[] = []

function makeClaim(): EmotiveClaimDetail {
  return {
    id: CLAIM_ID,
    faults: [
      {
        id: FAULT_ID,
        faultType: FaultType.Department,
        employeeId: null,
        employeeName: null,
        departmentId: DEPARTMENT_ID,
        departmentName: 'Glave',
        externalPartyId: null,
        externalPartyName: null,
        notes: null,
      },
    ],
  } as unknown as EmotiveClaimDetail
}

function renderSection(canEdit: boolean): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(departmentsReferenceOptions().queryKey, DEPARTMENTS)
  client.setQueryData(employeesReferenceOptions().queryKey, EMPLOYEES)
  client.setQueryData(externalPartiesReferenceOptions().queryKey, EXTERNAL_PARTIES)

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <EmotiveClaimFaultsSection claim={makeClaim()} canEdit={canEdit} />
    </QueryClientProvider>
  )
  render(node)
  return { client }
}

describe('EmotiveClaimFaultsSection', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders read-only without an edit button when editing is not allowed', () => {
    renderSection(false)

    expect(
      screen.queryByRole('button', { name: m.emotive_claims_detail_faults_edit() }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Glave')).toBeInTheDocument()
  })

  it('toggles into edit mode and back via cancel', () => {
    renderSection(true)

    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_faults_edit() }))

    expect(
      screen.getByRole('button', { name: m.emotive_claims_detail_faults_save() }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_faults_cancel() }))

    expect(
      screen.getByRole('button', { name: m.emotive_claims_detail_faults_edit() }),
    ).toBeInTheDocument()
  })

  it('saves via PATCH replace-all and returns to read-only', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...makeClaim() }) })
    vi.stubGlobal('fetch', fetchSpy)

    renderSection(true)

    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_faults_edit() }))
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_faults_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/emotive-claims/${CLAIM_ID}`)
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(String(init.body)) as { faults: unknown[] }
    expect(body.faults).toHaveLength(1)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: m.emotive_claims_detail_faults_edit() }),
      ).toBeInTheDocument(),
    )
  })
})
