import { describe, expect, it } from 'vitest'

import { buildMasterRows, mapDomaceToEmotiveRow } from '../map-domace-to-emotive-row.js'
import type { DomaceExportRow, EmotiveExportRow } from '../types.js'

const sampleDomace: DomaceExportRow = {
  sequenceNumber: 2,
  dateOfClaim: '2025-01-16',
  customerName: 'JERKO',
  mrNumber: '100262/25',
  workOrder: '100262/25',
  invoiceNumber: '173/24',
  problemDescription: 'AKSIJALNO ZARIBAO',
  dateOfFinish: '2025-02-01',
  engineTypeCode: 'ABC1',
  employeeId: 'emp-2',
  employeeName: 'MARKO ZIVANOVIC',
  outcome: 'accepted',
  totalAmount: 285165,
  notes: 'NAPOMENA',
  claimYear: 2025,
  faults: [],
}

const sampleEmotive: EmotiveExportRow = {
  sequenceNumber: 1,
  warrantyReport: 'POPUCALE KOŠULJICE',
  engineTypeCode: 'JQDB',
  dateOfClaim: '2025-02-25',
  mrNumber: '1759/23',
  dateOfFinish: '2023-06-28',
  claimNumber: 'RGC-24-32296',
  employeeId: 'emp-1',
  employeeName: 'BOBAN BOGOSAVLJEVIC',
  customerName: 'MR ENGINES',
  outcome: 'accepted',
  faults: [],
  sourceName: 'APPROVED GREEN',
  claimYear: 2025,
}

describe('mapDomaceToEmotiveRow', () => {
  it('maps domace fields into UKUPNO column layout', () => {
    const mapped = mapDomaceToEmotiveRow(sampleDomace)

    expect(mapped.warrantyReport).toBe('AKSIJALNO ZARIBAO')
    expect(mapped.mrNumber).toBe('100262/25')
    expect(mapped.claimNumber).toBe('173/24')
    expect(mapped.sourceName).toBe('JERKO')
    expect(mapped.claimYear).toBe(2025)
  })
})

describe('buildMasterRows', () => {
  it('merges emotive and domace rows for UKUPNO', () => {
    const masterRows = buildMasterRows({
      emotiveRows: [sampleEmotive],
      domaceRows: [sampleDomace],
      includeEmotive: true,
      includeDomace: true,
    })

    expect(masterRows).toHaveLength(2)
    expect(masterRows.map((row) => row.mrNumber)).toEqual(['100262/25', '1759/23'])
  })
})
