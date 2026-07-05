import { ClaimReportStatus } from '../enums.js'

/** Empty ProseMirror document returned by GET when no report row exists yet. */
export const DEFAULT_CLAIM_REPORT_CONTENT_JSON = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
} as const

export const DEFAULT_CLAIM_REPORT_CONTENT_HTML = '<p></p>'

export const MAX_CLAIM_REPORT_HTML_LENGTH = 500_000

export const DEFAULT_CLAIM_REPORT_STATUS = ClaimReportStatus.Draft
