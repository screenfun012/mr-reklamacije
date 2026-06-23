export const OFFICE_PREVIEW_MAX_BYTES = 20 * 1024 * 1024
export const OFFICE_PREVIEW_MAX_ROWS = 500
export const OFFICE_PREVIEW_MAX_COLS = 50

export const SPREADSHEET_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const

export const WORD_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const

export function isSpreadsheetMimeType(mimeType: string): boolean {
  return mimeType === SPREADSHEET_MIME
}

export function isWordMimeType(mimeType: string): boolean {
  return mimeType === WORD_MIME
}
