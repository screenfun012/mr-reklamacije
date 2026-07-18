import { describe, expect, it } from 'vitest'

import { ClaimFreshness, ClaimKind, ClaimOutcome, ClientClaimPhase } from '../../enums.js'
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
  clientVisibleAt: null,
  publishedAt: null,
  freshness: null,
  sectionFreshness: { photos: false, inspection: false, details: false, outcome: false },
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

/** Same claim, but with a decided (non-pending) real outcome, still private (unpublished). */
const privateDecidedDetail: EmotiveClaimDetail = {
  ...fullDetail,
  outcome: ClaimOutcome.Accepted,
  dateOfFinish: '2026-05-01',
  clientVisibleAt: '2026-04-20T00:00:00.000Z',
  publishedAt: null,
}

/** Same claim, published — the real outcome is now safe to reveal. */
const publishedDetail: EmotiveClaimDetail = {
  ...fullDetail,
  outcome: ClaimOutcome.Accepted,
  dateOfFinish: '2026-05-01',
  clientVisibleAt: '2026-04-20T00:00:00.000Z',
  publishedAt: '2026-05-02T00:00:00.000Z',
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
  'clientVisibleAt',
  'publishedAt',
]

describe('deriveClientClaimPhase', () => {
  it('private (unpublished) and never client-visible yet -> Received', () => {
    expect(
      deriveClientClaimPhase(ClaimOutcome.Accepted, { clientVisibleAt: null, publishedAt: null }),
    ).toBe(ClientClaimPhase.Received)
  })

  it('private (unpublished) but client-visible -> InProgress, regardless of the real outcome', () => {
    expect(
      deriveClientClaimPhase(ClaimOutcome.Accepted, {
        clientVisibleAt: '2026-04-20T00:00:00.000Z',
        publishedAt: null,
      }),
    ).toBe(ClientClaimPhase.InProgress)
  })

  it('published + pending -> InProgress (real in-progress, not masked)', () => {
    expect(
      deriveClientClaimPhase(ClaimOutcome.Pending, {
        clientVisibleAt: '2026-04-20T00:00:00.000Z',
        publishedAt: '2026-05-02T00:00:00.000Z',
      }),
    ).toBe(ClientClaimPhase.InProgress)
  })

  it('published + decided -> Outcome', () => {
    for (const outcome of [ClaimOutcome.Accepted, ClaimOutcome.Rejected, ClaimOutcome.Archived]) {
      expect(
        deriveClientClaimPhase(outcome, {
          clientVisibleAt: '2026-04-20T00:00:00.000Z',
          publishedAt: '2026-05-02T00:00:00.000Z',
        }),
      ).toBe(ClientClaimPhase.Outcome)
    }
  })
})

describe('toClientClaimListItem', () => {
  it('keeps only client-safe fields', () => {
    const item = toClientClaimListItem(fullDetail)

    expect(ClientClaimListItemSchema.parse(item)).toEqual(item)
    expect(item.customerName).toBe('JONKER')
    expect(item.outcome).toBe(ClaimOutcome.Pending)
    expect(item.warrantyReport).toBe('Kvar na motoru')
    expect(item.clientPhase).toBe(ClientClaimPhase.Received)
    // Status is derived server-side from clientVisibility (deriveClientClaimPhase),
    // so no redundant `progressPhase` field ships.
    expect('progressPhase' in item).toBe(false)

    for (const key of [...LEAKY_KEYS, 'employeeName']) {
      expect(key in item).toBe(false)
    }
  })

  it('masks the real outcome and dateOfFinish while unpublished, even once client-visible', () => {
    const item = toClientClaimListItem(privateDecidedDetail)

    expect(item.outcome).toBe(ClaimOutcome.Pending)
    expect(item.dateOfFinish).toBeNull()
    expect(item.clientPhase).toBe(ClientClaimPhase.InProgress)
    for (const key of LEAKY_KEYS) {
      expect(key in item).toBe(false)
    }
  })

  it('reveals the real outcome and dateOfFinish once published', () => {
    const item = toClientClaimListItem(publishedDetail)

    expect(item.outcome).toBe(ClaimOutcome.Accepted)
    expect(item.dateOfFinish).toBe('2026-05-01')
    expect(item.clientPhase).toBe(ClientClaimPhase.Outcome)
    for (const key of LEAKY_KEYS) {
      expect(key in item).toBe(false)
    }
  })

  it('carries an emotive item’s freshness through to the client wire', () => {
    const item = toClientClaimListItem({ ...fullDetail, freshness: ClaimFreshness.Update })
    expect(item.freshness).toBe(ClaimFreshness.Update)
  })

  it('keeps freshness null when there is nothing to flag', () => {
    const item = toClientClaimListItem({ ...fullDetail, freshness: null })
    expect(item.freshness).toBeNull()
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
    expect(detail.clientPhase).toBe(ClientClaimPhase.Received)
    expect('progressPhase' in detail).toBe(false)

    for (const key of LEAKY_KEYS) {
      expect(key in detail).toBe(false)
    }

    const serialized = JSON.stringify(detail)
    expect(serialized).not.toContain('TAJNA KRIVICA')
    expect(serialized).not.toContain('TAJNA INTERNA BELESKA')
    expect(serialized).not.toContain('44444444-4444-4444-8444-444444444444')
    expect(serialized).not.toContain('SELMAN')
  })

  it('masks outcome/dateOfFinish while private, reveals them once published', () => {
    const masked = toClientClaimDetail(privateDecidedDetail)
    expect(masked.outcome).toBe(ClaimOutcome.Pending)
    expect(masked.dateOfFinish).toBeNull()
    expect(masked.clientPhase).toBe(ClientClaimPhase.InProgress)
    for (const key of LEAKY_KEYS) {
      expect(key in masked).toBe(false)
    }

    const revealed = toClientClaimDetail(publishedDetail)
    expect(revealed.outcome).toBe(ClaimOutcome.Accepted)
    expect(revealed.dateOfFinish).toBe('2026-05-01')
    expect(revealed.clientPhase).toBe(ClientClaimPhase.Outcome)
    for (const key of LEAKY_KEYS) {
      expect(key in revealed).toBe(false)
    }
  })

  it('passes an emotive claim’s sectionFreshness through unchanged', () => {
    const sectionFreshness = { photos: true, inspection: false, details: true, outcome: false }
    const detail = toClientClaimDetail({ ...fullDetail, sectionFreshness })
    expect(detail.sectionFreshness).toEqual(sectionFreshness)
  })
})
