import { ClaimKind, ClaimOutcome, type DomaceClaimDetail } from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { DomaceClaimAmountSection } from '../domace-claim-amount-section.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

interface AmountOverrides {
  originalInvoiceAmount?: number | null
  partsAmount?: number | null
  laborAmount?: number | null
  totalAmount?: number | null
}

function makeClaim(
  outcome: DomaceClaimDetail['outcome'],
  amounts: AmountOverrides = {},
): DomaceClaimDetail {
  return {
    kind: ClaimKind.Domace,
    id: CLAIM_ID,
    sequenceNumber: 1,
    claimNumber: null,
    invoiceNumber: null,
    customerName: 'Auto Stanić',
    warrantyReport: null,
    engineTypeId: null,
    engineTypeCode: null,
    engineCode: null,
    dateOfClaim: null,
    mrNumber: 'MR-1',
    dateOfFinish: null,
    employeeId: null,
    employeeName: null,
    outcome,
    claimYear: 2026,
    originalInvoiceAmount: amounts.originalInvoiceAmount ?? null,
    partsAmount: amounts.partsAmount ?? null,
    laborAmount: amounts.laborAmount ?? null,
    totalAmount: amounts.totalAmount ?? null,
    createdAt: '2026-05-01T10:00:00.000Z',
    engineTypeManufacturer: null,
    manufacturerId: null,
    manufacturerName: null,
    internalNotes: null,
    inspectionReport: null,
    updatedBy: null,
    updatedAt: '2026-05-02T10:00:00.000Z',
    faults: [],
    findings: [],
  }
}

describe('DomaceClaimAmountSection', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('renders nothing when no amount is recorded', () => {
    render(<DomaceClaimAmountSection claim={makeClaim(ClaimOutcome.Pending)} />)
    expect(screen.queryByText(m.domace_claims_detail_section_amount())).not.toBeInTheDocument()
  })

  it('shows the breakdown on a PENDING claim (amounts no longer gated on accepted)', () => {
    render(
      <DomaceClaimAmountSection
        claim={makeClaim(ClaimOutcome.Pending, {
          partsAmount: 60000,
          laborAmount: 24500.5,
          totalAmount: 84500.5,
        })}
      />,
    )
    expect(screen.getByText(m.domace_claims_detail_section_amount())).toBeInTheDocument()
    expect(screen.getByText(m.domace_claims_create_field_parts_amount())).toBeInTheDocument()
    expect(screen.getByText(m.domace_claims_create_field_labor_amount())).toBeInTheDocument()
    expect(screen.getByText(/84\.500/)).toBeInTheDocument()
  })

  it('shows the original invoice amount even with no repair breakdown', () => {
    render(
      <DomaceClaimAmountSection
        claim={makeClaim(ClaimOutcome.Rejected, { originalInvoiceAmount: 50000 })}
      />,
    )
    expect(
      screen.getByText(m.domace_claims_create_field_original_invoice_amount()),
    ).toBeInTheDocument()
    expect(screen.getByText(/50\.000/)).toBeInTheDocument()
  })
})
