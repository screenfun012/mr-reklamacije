import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { buildReklamacijeWorkbook } from '../build-reklamacije-workbook.js'
import type { DomaceExportRow, EmotiveExportRow, EmployeeAssembledYearRow } from '../types.js'

const EXPORTED_AT = new Date('2026-06-21T10:00:00.000Z')

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
  faults: [
    {
      faultType: 'department',
      employeeName: null,
      departmentName: 'ODELENJE BLOKOVA',
      externalPartyName: null,
    },
  ],
  claimYear: 2025,
}

const sampleDomace: DomaceExportRow = {
  sequenceNumber: 2,
  dateOfClaim: '2025-01-16',
  customerName: 'JERKO',
  mrNumber: '100262/25',
  workOrder: '100262/25',
  invoiceNumber: '173/24',
  problemDescription: 'AKSIJALNO ZARIBAO',
  dateOfFinish: null,
  engineTypeCode: null,
  employeeId: 'emp-2',
  employeeName: 'MARKO ZIVANOVIC',
  outcome: 'accepted',
  totalAmount: 285165,
  claimYear: 2025,
  faults: [],
}

const sampleAssembled: EmployeeAssembledYearRow[] = [
  {
    employeeId: 'emp-1',
    employeeName: 'BOBAN BOGOSAVLJEVIC',
    year: 2025,
    enginesAssembled: 100,
  },
]

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
  it('creates master UKUPNO, data, stats, and year sheets', async () => {
    const buffer = await buildReklamacijeWorkbook({
      emotiveRows: [sampleEmotive],
      domaceRows: [sampleDomace],
      employeeAssembledByYear: sampleAssembled,
      includeEmotive: true,
      includeDomace: true,
      exportedAt: EXPORTED_AT,
    })

    const workbook = await readWorkbook(buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'UKUPNO SA 21.06.2026.',
      'EMOTIVE REKLAMACIJE',
      'DOMACE REKLAMACIJE ',
      'REKLAMACIJE PO ZAPOSLENOM',
      'REKLAMACIJE PO FIRMAMA',
      '2025',
    ])

    const ukupno = workbook.getWorksheet('UKUPNO SA 21.06.2026.')
    expect(ukupno!.rowCount).toBe(3)
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

    const emotiveData = workbook.getWorksheet('EMOTIVE REKLAMACIJE')
    expect(emotiveData!.rowCount).toBe(2)
    expect(rowValues(emotiveData!, 2)[4]).toBe('1759/23')
    // REMARKS (column 10, index 9) is the customer the claim is for — the firm
    // for an emotive claim. It used to carry the (usually empty) claim source.
    expect(rowValues(emotiveData!, 2)[9]).toBe('MR ENGINES')

    // On UKUPNO, a domace row shows its client in the same REMARKS column. Rows
    // are sorted, so find the domace one by its MR number rather than assuming order.
    const ukupnoDomace = [2, 3]
      .map((n) => rowValues(ukupno!, n))
      .find((values) => values[4] === '100262/25')
    expect(ukupnoDomace?.[9]).toBe('JERKO')

    const firmStats = workbook.getWorksheet('REKLAMACIJE PO FIRMAMA')
    expect(rowValues(firmStats!, 4)[0]).toBe('MR ENGINES')
    expect(rowValues(firmStats!, 4)[1]).toBe(1)

    const employeeStats = workbook.getWorksheet('REKLAMACIJE PO ZAPOSLENOM')
    expect(rowValues(employeeStats!, 2)[0]).toBe('BOBAN BOGOSAVLJEVIC')
    expect(rowValues(employeeStats!, 2)[1]).toBe(100)
    expect(rowValues(employeeStats!, 2)[2]).toBe(1)

    const domace = workbook.getWorksheet('DOMACE REKLAMACIJE ')
    const domaceHeaders = rowValues(domace!, 1)
    expect(domaceHeaders[0]).toBe('R.B.')
    // The sheet ends at ZAPOSLENI: the old NAPOMENA column carried the single
    // free-text note that multi-row findings replaced, and findings deliberately
    // stay out of the export — the reason lives in OPIS PROBLEMA.
    expect(domaceHeaders.at(-1)).toBe('ZAPOSLENI')
    expect(domaceHeaders).not.toContain('NAPOMENA')

    const yearSheet = workbook.getWorksheet('2025')
    expect(yearSheet!.rowCount).toBe(3)
  })

  it('omits emotive sheets when includeEmotive is false', async () => {
    const buffer = await buildReklamacijeWorkbook({
      emotiveRows: [sampleEmotive],
      domaceRows: [sampleDomace],
      employeeAssembledByYear: sampleAssembled,
      includeEmotive: false,
      includeDomace: true,
      exportedAt: EXPORTED_AT,
    })

    const workbook = await readWorkbook(buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'UKUPNO SA 21.06.2026.',
      'DOMACE REKLAMACIJE ',
      '2025',
    ])
  })
})
