export interface CappedSheetMatrix {
  readonly rows: readonly (readonly string[])[]
  readonly totalRows: number
  readonly totalCols: number
  readonly truncated: boolean
}

function cellToDisplayString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value)
}

export function capSheetMatrix(
  rawRows: readonly (readonly unknown[])[],
  maxRows: number,
  maxCols: number,
): CappedSheetMatrix {
  const totalRows = rawRows.length
  const totalCols = rawRows.reduce((max, row) => Math.max(max, row.length), 0)

  const rowLimit = Math.min(totalRows, maxRows)
  const colLimit = Math.min(totalCols, maxCols)

  const rows: string[][] = []

  for (let rowIndex = 0; rowIndex < rowLimit; rowIndex += 1) {
    const sourceRow = rawRows[rowIndex] ?? []
    const cappedRow: string[] = []

    for (let colIndex = 0; colIndex < colLimit; colIndex += 1) {
      cappedRow.push(cellToDisplayString(sourceRow[colIndex]))
    }

    rows.push(cappedRow)
  }

  const truncated = totalRows > maxRows || totalCols > maxCols

  return {
    rows,
    totalRows,
    totalCols,
    truncated,
  }
}
