import type ExcelJS from 'exceljs'

import {
  computeDepartmentFaultYearStats,
  computeEmployeeClaimRateStats,
  type DepartmentFaultYearStatRow,
  type EmployeeClaimRateStatRow,
} from './compute-emotive-export-stats.js'
import type { EmotiveExportRow, EmployeeAssembledYearRow } from './types.js'

const BLOCK_WIDTH = 4
const BLOCK_GAP = 1

function blockStartColumn(blockIndex: number): number {
  return blockIndex * (BLOCK_WIDTH + BLOCK_GAP) + 1
}

function employeeRowsByYear(
  stats: readonly EmployeeClaimRateStatRow[],
  year: number,
): readonly EmployeeClaimRateStatRow[] {
  return stats.filter((row) => row.year === year)
}

function departmentRowsByYear(
  stats: readonly DepartmentFaultYearStatRow[],
  year: number,
): readonly DepartmentFaultYearStatRow[] {
  return stats.filter((row) => row.year === year)
}

export function addEmployeeStatsSheet(
  workbook: ExcelJS.Workbook,
  emotiveRows: readonly EmotiveExportRow[],
  assembledRows: readonly EmployeeAssembledYearRow[],
): void {
  const sheet = workbook.addWorksheet('REKLAMACIJE PO ZAPOSLENOM')
  const years = [...new Set(emotiveRows.map((row) => row.claimYear))].sort(
    (left, right) => right - left,
  )

  if (years.length === 0) {
    return
  }

  const employeeStats = computeEmployeeClaimRateStats(emotiveRows, assembledRows)
  const departmentStats = computeDepartmentFaultYearStats(emotiveRows)

  const headerRow = sheet.getRow(1)
  years.forEach((year, blockIndex) => {
    const col = blockStartColumn(blockIndex)
    headerRow.getCell(col).value = `SKLOPLJENO U ${year}`
    headerRow.getCell(col + 2).value = 'BROJ REKLAMACIJA'
    headerRow.getCell(col + 3).value = 'PROCENAT'
    headerRow.getCell(col).font = { bold: true }
    headerRow.getCell(col + 2).font = { bold: true }
    headerRow.getCell(col + 3).font = { bold: true }
  })

  const maxEmployeeRows = Math.max(
    ...years.map((year) => employeeRowsByYear(employeeStats, year).length),
    0,
  )
  for (let itemIndex = 0; itemIndex < maxEmployeeRows; itemIndex += 1) {
    const dataRow = sheet.getRow(itemIndex + 2)
    years.forEach((year, blockIndex) => {
      const item = employeeRowsByYear(employeeStats, year)[itemIndex]
      if (item === undefined) {
        return
      }

      const col = blockStartColumn(blockIndex)
      dataRow.getCell(col).value = item.employeeName
      dataRow.getCell(col + 1).value = item.enginesAssembled
      dataRow.getCell(col + 2).value = item.claimCount
      if (item.claimRate !== null) {
        dataRow.getCell(col + 3).value = item.claimRate
        dataRow.getCell(col + 3).numFmt = '0.000'
      }
    })
  }

  const nextRow = maxEmployeeRows + 4
  const maxDepartmentRows = Math.max(
    ...years.map((year) => departmentRowsByYear(departmentStats, year).length),
    0,
  )

  for (let itemIndex = 0; itemIndex < maxDepartmentRows; itemIndex += 1) {
    const dataRow = sheet.getRow(nextRow + itemIndex)
    years.forEach((year, blockIndex) => {
      const item = departmentRowsByYear(departmentStats, year)[itemIndex]
      if (item === undefined) {
        return
      }

      const col = blockStartColumn(blockIndex)
      dataRow.getCell(col).value = item.departmentName
      dataRow.getCell(col + 2).value = item.faultCount
    })
  }

  sheet.columns = [{ width: 28 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 4 }]
}
