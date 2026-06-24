import ExcelJS from 'exceljs'

import { addEmployeeStatsSheet } from './build-employee-stats-sheet.js'
import { addFirmStatsSheet } from './build-firm-stats-sheet.js'
import { formatDomaceOutcome } from './format-domace-outcome.js'
import { formatExportDate, formatSheetDateLabel } from './format-export-date.js'
import { formatGreska } from './format-greska.js'
import { buildMasterRows } from './map-domace-to-emotive-row.js'
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
  'RADNI NALOG',
  'BROJ RACUNA',
  'OPIS PROBLEMA',
  'REKLAMACIJA',
  'UKUPNO',
  'ZAPOSLENI',
  'NAPOMENA',
] as const

const EMOTIVE_DATA_SHEET_NAME = 'EMOTIVE REKLAMACIJE'
const DOMACE_DATA_SHEET_NAME = 'DOMACE REKLAMACIJE '

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
    row.workOrder,
    row.invoiceNumber,
    row.problemDescription,
    formatDomaceOutcome(row.outcome),
    row.totalAmount,
    row.employeeName,
    row.notes,
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

function addDomaceSheet(workbook: ExcelJS.Workbook, rows: readonly DomaceExportRow[]): void {
  const sheet = workbook.addWorksheet(DOMACE_DATA_SHEET_NAME)
  addHeaderRow(sheet, DOMACE_HEADERS)

  for (const row of rows) {
    sheet.addRow(domaceRowValues(row))
  }

  sheet.columns = DOMACE_HEADERS.map((header) => ({
    width: Math.max(header.length + 2, 14),
  }))
}

function addYearSheets(workbook: ExcelJS.Workbook, masterRows: readonly EmotiveExportRow[]): void {
  const years = [...new Set(masterRows.map((row) => row.claimYear))].sort(
    (left, right) => right - left,
  )

  for (const year of years) {
    const yearRows = masterRows.filter((row) => row.claimYear === year)
    addEmotiveSheet(workbook, String(year), yearRows)
  }
}

export async function buildReklamacijeWorkbook(input: ReklamacijeWorkbookInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const exportedAt = input.exportedAt ?? new Date()
  const masterRows = buildMasterRows(input)

  if (masterRows.length > 0) {
    const ukupnoName = `UKUPNO SA ${formatSheetDateLabel(exportedAt)}.`
    addEmotiveSheet(workbook, ukupnoName, masterRows)
  }

  if (input.includeEmotive && input.emotiveRows.length > 0) {
    addEmotiveSheet(workbook, EMOTIVE_DATA_SHEET_NAME, input.emotiveRows)
  }

  if (input.includeDomace && input.domaceRows.length > 0) {
    addDomaceSheet(workbook, input.domaceRows)
  }

  if (input.includeEmotive && input.emotiveRows.length > 0) {
    addEmployeeStatsSheet(workbook, input.emotiveRows, input.employeeAssembledByYear)
    addFirmStatsSheet(workbook, input.emotiveRows)
  }

  if (masterRows.length > 0) {
    addYearSheets(workbook, masterRows)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export type {
  DomaceExportRow,
  EmotiveClaimOutcome,
  EmotiveExportRow,
  EmployeeAssembledYearRow,
  ExportFaultRow,
  ReklamacijeWorkbookInput,
} from './types.js'
