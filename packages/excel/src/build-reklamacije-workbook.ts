import ExcelJS from 'exceljs'

import { formatDomaceOutcome } from './format-domace-outcome.js'
import { formatExportDate, formatSheetDateLabel } from './format-export-date.js'
import { formatGreska } from './format-greska.js'
import type { DomaceExportRow, EmotiveExportRow, ReklamacijeWorkbookInput } from './types.js'

const EMOTIVE_HEADERS = [
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
] as const

const DOMACE_HEADERS = [
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
] as const

function addHeaderRow(sheet: ExcelJS.Worksheet, headers: readonly string[]): void {
  const row = sheet.addRow([...headers])
  row.font = { bold: true }
}

function emotiveRowValues(row: EmotiveExportRow): (string | number | null)[] {
  return [
    row.sequenceNumber,
    row.warrantyReport,
    row.engineTypeCode,
    formatExportDate(row.dateOfClaim),
    row.mrNumber,
    formatExportDate(row.dateOfFinish),
    row.claimNumber,
    row.employeeName,
    formatGreska(row.faults),
    row.sourceName,
    row.claimYear,
  ]
}

function domaceRowValues(row: DomaceExportRow): (string | number | null)[] {
  return [
    row.sequenceNumber,
    formatExportDate(row.dateOfClaim),
    row.customerName,
    null,
    null,
    null,
    null,
    null,
    null,
    formatDomaceOutcome(row.outcome),
    null,
    null,
    row.totalAmount,
    row.employeeName,
    row.internalNotes,
  ]
}

function addEmotiveSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: readonly EmotiveExportRow[],
): void {
  const sheet = workbook.addWorksheet(sheetName)
  addHeaderRow(sheet, EMOTIVE_HEADERS)

  for (const row of rows) {
    sheet.addRow(emotiveRowValues(row))
  }

  sheet.columns = EMOTIVE_HEADERS.map((header) => ({
    width: Math.max(header.length + 2, 14),
  }))
}

function addDomaceSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: readonly DomaceExportRow[],
): void {
  const sheet = workbook.addWorksheet(sheetName)
  addHeaderRow(sheet, DOMACE_HEADERS)

  for (const row of rows) {
    sheet.addRow(domaceRowValues(row))
  }

  sheet.columns = DOMACE_HEADERS.map((header) => ({
    width: Math.max(header.length + 2, 14),
  }))
}

export async function buildReklamacijeWorkbook(input: ReklamacijeWorkbookInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const exportedAt = input.exportedAt ?? new Date()

  if (input.includeEmotive) {
    const ukupnoName = `UKUPNO SA ${formatSheetDateLabel(exportedAt)}.`
    addEmotiveSheet(workbook, ukupnoName, input.emotiveRows)

    const years = [...new Set(input.emotiveRows.map((row) => row.claimYear))].sort(
      (left, right) => right - left,
    )

    for (const year of years) {
      const yearRows = input.emotiveRows.filter((row) => row.claimYear === year)
      addEmotiveSheet(workbook, String(year), yearRows)
    }
  }

  if (input.includeDomace) {
    addDomaceSheet(workbook, 'DOMACE REKLAMACIJE ', input.domaceRows)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export type {
  DomaceExportRow,
  EmotiveExportRow,
  ExportFaultRow,
  ReklamacijeWorkbookInput,
} from './types.js'
