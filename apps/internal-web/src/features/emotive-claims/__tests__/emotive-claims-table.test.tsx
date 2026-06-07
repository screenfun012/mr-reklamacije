import { setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { EmotiveClaimsTable } from '../emotive-claims-table.js'

const emptyLookups = {
  customerNameById: new Map<string, string>(),
  engineCodeById: new Map<string, string>(),
}

describe('EmotiveClaimsTable', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('renders empty state when there are no rows', () => {
    render(<EmotiveClaimsTable items={[]} lookups={emptyLookups} />)

    expect(screen.getByRole('status')).toHaveTextContent('Nema reklamacija')
  })

  it('renders claim rows with lookups', () => {
    render(
      <EmotiveClaimsTable
        items={[
          {
            id: '11111111-1111-4111-8111-111111111111',
            sequenceNumber: 1,
            claimNumber: 'EM-2026-001',
            warrantyReport: 'Test',
            engineTypeId: '22222222-2222-4222-8222-222222222222',
            dateOfClaim: '2026-04-17',
            mrNumber: '5376/26',
            dateOfFinish: null,
            employeeId: '33333333-3333-4333-8333-333333333333',
            sourceId: '44444444-4444-4444-8444-444444444444',
            outcome: 'pending',
            claimYear: 2026,
            customerId: '55555555-5555-4555-8555-555555555555',
            createdAt: '2026-04-17T10:00:00.000Z',
          },
        ]}
        lookups={{
          customerNameById: new Map([['55555555-5555-4555-8555-555555555555', 'Auto Stanić']]),
          engineCodeById: new Map([['22222222-2222-4222-8222-222222222222', 'D4HB']]),
        }}
      />,
    )

    expect(screen.getByText('5376/26')).toBeInTheDocument()
    expect(screen.getByText('EM-2026-001')).toBeInTheDocument()
    expect(screen.getByText('Auto Stanić')).toBeInTheDocument()
    expect(screen.getByText('D4HB')).toBeInTheDocument()
    expect(screen.getByText('U obradi')).toBeInTheDocument()
  })
})
