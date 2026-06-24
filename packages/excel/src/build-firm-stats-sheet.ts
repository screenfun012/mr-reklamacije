import type ExcelJS from 'exceljs'

import {
  computeCustomerYearStats,
  type CustomerYearStatRow,
} from './compute-emotive-export-stats.js'
import type { EmotiveExportRow } from './types.js'

const BLOCK_WIDTH = 4
const BLOCK_GAP = 2

function blockStartColumn(blockIndex: number): number {
  return blockIndex * (BLOCK_WIDTH + BLOCK_GAP) + 1
}

function yearTitle(year: number): string {
  return `REKLAMACIJE ${year} OD 01.01.${year} - 31.12.${year}.`
}

function customerRowsByYear(
  stats: readonly CustomerYearStatRow[],
  year: number,
): readonly CustomerYearStatRow[] {
  return stats.filter((row) => row.year === year)
}

export function addFirmStatsSheet(
  workbook: ExcelJS.Workbook,
  rows: readonly EmotiveExportRow[],
): void {
  const sheet = workbook.addWorksheet('REKLAMACIJE PO FIRMAMA')
  const years = [...new Set(rows.map((row) => row.claimYear))].sort((left, right) => right - left)

  if (years.length === 0) {
    return
  }

  const customerStats = computeCustomerYearStats(rows)

  const titleRow = sheet.getRow(1)
  years.forEach((year, blockIndex) => {
    const col = blockStartColumn(blockIndex)
    titleRow.getCell(col).value = yearTitle(year)
    titleRow.getCell(col).font = { bold: true }
  })

  const headerRow = sheet.getRow(3)
  years.forEach((_year, blockIndex) => {
    const col = blockStartColumn(blockIndex)
    const labels = ['NAZIV FIRME', 'PRIHVAĆENO', 'ODBIJENO', 'TOTAL']
    labels.forEach((label, offset) => {
      const cell = headerRow.getCell(col + offset)
      cell.value = label
      cell.font = { bold: true }
    })
  })

  const maxRows = Math.max(
    ...years.map((year) => customerRowsByYear(customerStats, year).length),
    0,
  )
  for (let itemIndex = 0; itemIndex < maxRows; itemIndex += 1) {
    const dataRow = sheet.getRow(itemIndex + 4)
    years.forEach((year, blockIndex) => {
      const item = customerRowsByYear(customerStats, year)[itemIndex]
      if (item === undefined) {
        return
      }

      const col = blockStartColumn(blockIndex)
      dataRow.getCell(col).value = item.customerName
      dataRow.getCell(col + 1).value = item.accepted
      dataRow.getCell(col + 2).value = item.rejected
      dataRow.getCell(col + 3).value = item.total
    })
  }

  sheet.columns = [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 4 }]
}
