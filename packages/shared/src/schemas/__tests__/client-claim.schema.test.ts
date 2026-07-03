import { describe, expect, it } from 'vitest'

import { ClaimKind, ClaimOutcome, ClientClaimPhase } from '../../enums.js'
import type { EmotiveClaimDetail } from '../emotive-claim.schema.js'
import {
  ClientClaimDetailSchema,
  ClientClaimListItemSchema,
  deriveClientClaimPhase,
  toClientClaimDetail,
  toClientClaimListItem,
} from '../client-claim.schema.js'

const fullDetail: EmotiveClaimDetail = {
  kind: ClaimKind.Emotive,
  id: '11111111-1111-4111-8111-111111111111',
  sequenceNumber: 7,
  claimNumber: 'CN-1',
  warrantyReport: 'Kvar na motoru',
  engineTypeId: '22222222-2222-4222-8222-222222222222',
  engineTypeCode: 'ENG-1',
  manufacturerId: '33333333-3333-4333-8333-333333333333',
  manufacturerName: 'Bosch',
  engineCode: 'EC-1',
  dateOfClaim: '2026-04-17',
  mrNumber: '5376/25',
  dateOfFinish: null,
  employeeId: '44444444-4444-4444-8444-444444444444',
  employeeName: 'Dejan Milovanović',
  sourceId: '55555555-5555-4555-8555-555555555555',
  outcome: ClaimOutcome.Pending,
  claimYear: 2026,
  customerId: '66666666-6666-4666-8666-666666666666',
  customerName: 'JONKER',
  createdAt: '2026-04-17T10:00:00.000Z',
  engineTypeManufacturer: 'Bosch',
  sourceCode: 'SELMAN',
  sourceName: 'Selman partner',
  internalNotes: 'TAJNA INTERNA BELESKA',
  inspectionReport: 'Cylinder head inspected, within tolerance.',
  updatedBy: '77777777-7777-4777-8777-777777777777',
  updatedAt: '2026-04-18T10:00:00.000Z',
  faults: [
    {
      id: '88888888-8888-4888-8888-888888888888',
      faultType: 'employee',
      employeeId: '44444444-4444-4444-8444-444444444444',
      employeeName: 'Dejan Milovanović',
      departmentId: null,
      departmentName: null,
      externalPartyId: null,
      externalPartyName: null,
      notes: 'TAJNA KRIVICA',
    },
  ],
}

const LEAKY_KEYS = [
  'employeeId',
  'faults',
  'internalNotes',
  'updatedBy',
  'updatedAt',
  'sourceId',
  'sourceCode',
  'sourceName',
  'customerId',
  'sequenceNumber',
]

describe('deriveClientClaimPhase', () => {
  it('maps outcome + handler assignment onto the three portal phases', () => {
    expect(deriveClientClaimPhase(ClaimOutcome.Pending, null)).toBe(ClientClaimPhase.Received)
    expect(deriveClientClaimPhase(ClaimOutcome.Pending, fullDetail.employeeId)).toBe(
      ClientClaimPhase.InProgress,
    )
    expect(deriveClientClaimPhase(ClaimOutcome.Accepted, null)).toBe(ClientClaimPhase.Outcome)
    expect(deriveClientClaimPhase(ClaimOutcome.Rejected, fullDetail.employeeId)).toBe(
      ClientClaimPhase.Outcome,
    )
    expect(deriveClientClaimPhase(ClaimOutcome.Archived, null)).toBe(ClientClaimPhase.Outcome)
  })
})

describe('toClientClaimListItem', () => {
  it('keeps only client-safe fields', () => {
    const item = toClientClaimListItem(fullDetail)

    expect(ClientClaimListItemSchema.parse(item)).toEqual(item)
    expect(item.customerName).toBe('JONKER')
    expect(item.outcome).toBe(ClaimOutcome.Pending)
    expect(item.warrantyReport).toBe('Kvar na motoru')
    // The phase ships instead of the signals behind it.
    expect(item.progressPhase).toBe(ClientClaimPhase.InProgress)

    for (const key of [...LEAKY_KEYS, 'employeeName']) {
      expect(key in item).toBe(false)
    }
  })
})

describe('toClientClaimDetail', () => {
  it('strips faults, internal notes and ids — no secret value survives', () => {
    const detail = toClientClaimDetail(fullDetail)

    expect(ClientClaimDetailSchema.parse(detail)).toEqual(detail)
    expect(detail.engineTypeManufacturer).toBe('Bosch')
    // Client-visible worker summary IS exposed (unlike internal notes / faults).
    expect(detail.inspectionReport).toBe('Cylinder head inspected, within tolerance.')
    // The assigned technician's NAME is a deliberate whitelist extension
    // (approved 2026-07-03) — the employee id must still never leak.
    expect(detail.employeeName).toBe('Dejan Milovanović')
    expect(detail.progressPhase).toBe(ClientClaimPhase.InProgress)

    for (const key of LEAKY_KEYS) {
      expect(key in detail).toBe(false)
    }

    const serialized = JSON.stringify(detail)
    expect(serialized).not.toContain('TAJNA KRIVICA')
    expect(serialized).not.toContain('TAJNA INTERNA BELESKA')
    expect(serialized).not.toContain('44444444-4444-4444-8444-444444444444')
    expect(serialized).not.toContain('SELMAN')
  })
})
