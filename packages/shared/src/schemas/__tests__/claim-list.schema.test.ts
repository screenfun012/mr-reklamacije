import { describe, expect, it } from 'vitest'

import { ClaimKind, ClaimOutcome } from '../../enums.js'
import {
  ClaimListQuerySchema,
  ClaimListResponseSchema,
  ClaimSortBy,
  ClaimSortDir,
} from '../claim-list.schema.js'

describe('ClaimListQuerySchema', () => {
  it('accepts whitelisted sortBy and sortDir values', () => {
    const parsed = ClaimListQuerySchema.parse({
      sortBy: ClaimSortBy.DateOfClaim,
      sortDir: ClaimSortDir.Asc,
      page: 1,
      pageSize: 10,
    })

    expect(parsed.sortBy).toBe('dateOfClaim')
    expect(parsed.sortDir).toBe('asc')
  })

  it('rejects invalid sortBy values such as SQL injection attempts', () => {
    expect(() =>
      ClaimListQuerySchema.parse({
        sortBy: 'date_of_claim; DROP TABLE emotive_claims',
        page: 1,
        pageSize: 10,
      }),
    ).toThrow()
  })

  it('rejects unknown sortBy column names', () => {
    expect(() =>
      ClaimListQuerySchema.parse({
        sortBy: 'mrNumber',
        page: 1,
        pageSize: 10,
      }),
    ).toThrow()
  })

  it('rejects invalid sortDir values', () => {
    expect(() =>
      ClaimListQuerySchema.parse({
        sortBy: ClaimSortBy.DateOfFinish,
        sortDir: 'up',
        page: 1,
        pageSize: 10,
      }),
    ).toThrow()
  })
})

describe('ClaimListResponseSchema', () => {
  it('accepts unified list items when numeric fields arrive as JSON strings from raw SQL', () => {
    const parsed = ClaimListResponseSchema.parse({
      items: [
        {
          kind: ClaimKind.Emotive,
          id: '11111111-1111-4111-8111-111111111111',
          sequenceNumber: '42',
          claimNumber: 'EM-2026-001',
          warrantyReport: 'Test',
          engineTypeId: '22222222-2222-4222-8222-222222222222',
          engineTypeCode: 'BMW N47D20D',
          manufacturerId: null,
          manufacturerName: null,
          engineCode: null,
          dateOfClaim: '2026-04-17',
          mrNumber: '5376/26',
          dateOfFinish: null,
          employeeId: null,
          employeeName: null,
          sourceId: null,
          outcome: ClaimOutcome.Pending,
          claimYear: '2026',
          customerId: null,
          customerName: 'SELMAN',
          createdAt: '2026-04-17T10:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    })

    expect(parsed.items[0]?.sequenceNumber).toBe(42)
    expect(parsed.items[0]?.claimYear).toBe(2026)
  })

  it('accepts pagination total when it arrives as a JSON string from raw SQL', () => {
    const parsed = ClaimListResponseSchema.parse({
      items: [],
      total: '68',
      page: 1,
      pageSize: 10,
    })

    expect(parsed.total).toBe(68)
  })
})
