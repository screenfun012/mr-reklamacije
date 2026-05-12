/**
 * Excel serial days use the 1900 date system with 1899-12-30 as day 0 in the
 * common JS mapping. `(serial - 25569) * 86400000` is the UTC instant used by
 * ExcelJS and matches Microsoft’s published serial↔calendar pairs when callers
 * use local getters (`getFullYear` / `getMonth` / `getDate`), e.g. in
 * Europe/Belgrade (verified for reference serials 39448, 40729, 42736, 44927).
 */
const EXCEL_UNIX_EPOCH_OFFSET = 25569
const MS_PER_DAY = 86400000

const RE_DD_MM_YYYY = /^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?\s*$/
const RE_DD_MM_YYYY_DASH = /^(\d{1,2})-(\d{1,2})-(\d{4})$/
const RE_SLASH = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

function toCalendarDateOrNull(year: number, month1To12: number, day: number): Date | null {
  if (month1To12 < 1 || month1To12 > 12) {
    return null
  }
  if (day < 1 || day > 31) {
    return null
  }
  const d = new Date(year, month1To12 - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month1To12 - 1 || d.getDate() !== day) {
    return null
  }
  return d
}

function parseDdMmYyyyDot(trimmed: string): Date | null {
  const m = RE_DD_MM_YYYY.exec(trimmed)
  if (!m) {
    return null
  }
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  return toCalendarDateOrNull(year, month, day)
}

function parseDdMmYyyyDash(trimmed: string): Date | null {
  const m = RE_DD_MM_YYYY_DASH.exec(trimmed)
  if (!m) {
    return null
  }
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  return toCalendarDateOrNull(year, month, day)
}

function parseSlashDate(trimmed: string): Date | null {
  const m = RE_SLASH.exec(trimmed)
  if (!m) {
    return null
  }
  const a = Number(m[1])
  const b = Number(m[2])
  const year = Number(m[3])

  let month1To12: number
  let day: number

  if (a > 12) {
    day = a
    month1To12 = b
  } else if (b > 12) {
    month1To12 = a
    day = b
  } else {
    month1To12 = a
    day = b
  }

  return toCalendarDateOrNull(year, month1To12, day)
}

function excelSerialToDate(serial: number): Date {
  return new Date((serial - EXCEL_UNIX_EPOCH_OFFSET) * MS_PER_DAY)
}

export function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null
    }
    if (value <= 0) {
      return null
    }
    const serial = Math.floor(value)
    return excelSerialToDate(serial)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return null
    }

    return parseDdMmYyyyDot(trimmed) ?? parseDdMmYyyyDash(trimmed) ?? parseSlashDate(trimmed)
  }

  return null
}
