import type { DomaceExportRow, EmotiveExportRow } from './types.js'

/** Maps a domace row into UKUPNO / year-sheet (emotive column layout). */
export function mapDomaceToEmotiveRow(row: DomaceExportRow): EmotiveExportRow {
  const mrNumber = row.workOrder?.trim() ?? row.mrNumber?.trim() ?? ''

  return {
    sequenceNumber: row.sequenceNumber,
    warrantyReport: row.problemDescription,
    engineTypeCode: row.engineTypeCode ?? '',
    dateOfClaim: row.dateOfClaim,
    mrNumber,
    dateOfFinish: row.dateOfFinish,
    claimNumber: row.invoiceNumber,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    customerName: row.customerName,
    outcome: row.outcome,
    faults: row.faults,
    claimYear: row.claimYear,
  }
}

export function sortMasterRows(rows: readonly EmotiveExportRow[]): EmotiveExportRow[] {
  return [...rows].sort((left, right) => {
    if (left.claimYear !== right.claimYear) {
      return right.claimYear - left.claimYear
    }

    const leftDate = left.dateOfClaim ?? ''
    const rightDate = right.dateOfClaim ?? ''
    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate)
    }

    return left.sequenceNumber - right.sequenceNumber
  })
}

export function buildMasterRows(input: {
  emotiveRows: readonly EmotiveExportRow[]
  domaceRows: readonly DomaceExportRow[]
  includeEmotive: boolean
  includeDomace: boolean
}): EmotiveExportRow[] {
  const rows: EmotiveExportRow[] = []

  if (input.includeEmotive) {
    rows.push(...input.emotiveRows)
  }

  if (input.includeDomace) {
    rows.push(...input.domaceRows.map(mapDomaceToEmotiveRow))
  }

  return sortMasterRows(rows)
}
