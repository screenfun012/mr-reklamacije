import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { buildReklamacijeWorkbook } from '../build-reklamacije-workbook.js'
import type { DomaceExportRow, EmotiveExportRow } from '../types.js'

const EXPORTED_AT = new Date('2026-06-21T10:00:00.000Z')

const sampleEmotive: EmotiveExportRow = {
  sequenceNumber: 1,
  warrantyReport: 'POPUCALE KOŠULJICE',
  engineTypeCode: 'JQDB',
  dateOfClaim: '2025-02-25',
  mrNumber: '1759/23',
  dateOfFinish: '2023-06-28',
  claimNumber: 'RGC-24-32296',
  employeeName: 'BOBAN BOGOSAVLJEVIC',
  faults: [
    {
      faultType: 'department',
      employeeName: null,
      departmentName: 'ODELENJE BLOKOVA',
      externalPartyName: null,
    },
  ],
  sourceName: 'APPROVED GREEN',
  claimYear: 2025,
}

const sampleDomace: DomaceExportRow = {
  sequenceNumber: 1,
  dateOfClaim: '2025-01-16',
  customerName: 'JERKO',
  outcome: 'accepted',
  totalAmount: 285165,
  employeeName: 'MARKO ZIVANOVIC',
  internalNotes: 'Napomena test',
}

async function readWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): unknown[] {
  const row = sheet.getRow(rowNumber)
  const values: unknown[] = []
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    values[colNumber - 1] = cell.value
  })
  return values
}

describe('buildReklamacijeWorkbook', () => {
  it('creates UKUPNO, year, and DOMACE sheets with legacy headers', async () => {
    const buffer = await buildReklamacijeWorkbook({
      emotiveRows: [sampleEmotive],
      domaceRows: [sampleDomace],
      includeEmotive: true,
      includeDomace: true,
      exportedAt: EXPORTED_AT,
    })

    const workbook = await readWorkbook(buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'UKUPNO SA 21.06.2026.',
      '2025',
      'DOMACE REKLAMACIJE ',
    ])

    const ukupno = workbook.getWorksheet('UKUPNO SA 21.06.2026.')
    expect(ukupno).toBeDefined()
    expect(rowValues(ukupno!, 1).slice(0, 11)).toEqual([
      'N0',
      'WARRANTY REPORT',
      'ENGINE TYPE',
      'DATE OF CLAIM',
      'MR NUMBER',
      'DATE OF FINISH',
      'CLAIM NUMBER',
      'EMPLOYEE',
      'GRESKA',
      'REMARKS',
      'GODINA',
    ])
    expect(rowValues(ukupno!, 2)).toEqual([
      1,
      'POPUCALE KOŠULJICE',
      'JQDB',
      '25.02.2025.',
      '1759/23',
      '28.06.2023.',
      'RGC-24-32296',
      'BOBAN BOGOSAVLJEVIC',
      'ODELENJE BLOKOVA',
      'APPROVED GREEN',
      2025,
    ])

    const yearSheet = workbook.getWorksheet('2025')
    expect(rowValues(yearSheet!, 2)[0]).toBe(1)

    const domace = workbook.getWorksheet('DOMACE REKLAMACIJE ')
    expect(rowValues(domace!, 1).slice(0, 15)).toEqual([
      'R.B.',
      'DATUM',
      'IME STRANKE',
      'VOZILO ',
      'RADNI NALOG',
      'STARI R/N',
      'IZNOS ORIGINALNOG  RACUNA',
      'BROJ RACUNA',
      'OPIS PROBLEMA',
      'REKLAMACIJA ',
      'IZNOS DELOVA BEZ PDV',
      'IZNOS RADA BEZ PDV',
      'UKUPNO ',
      'ZAPOSLENI ',
      'NAPOMENA ',
    ])
    expect(rowValues(domace!, 2)).toEqual([
      1,
      '16.01.2025.',
      'JERKO',
      null,
      null,
      null,
      null,
      null,
      null,
      'PRIHVACENA',
      null,
      null,
      285165,
      'MARKO ZIVANOVIC',
      'Napomena test',
    ])
  })

  it('omits emotive sheets when includeEmotive is false', async () => {
    const buffer = await buildReklamacijeWorkbook({
      emotiveRows: [sampleEmotive],
      domaceRows: [sampleDomace],
      includeEmotive: false,
      includeDomace: true,
      exportedAt: EXPORTED_AT,
    })

    const workbook = await readWorkbook(buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['DOMACE REKLAMACIJE '])
  })
})
