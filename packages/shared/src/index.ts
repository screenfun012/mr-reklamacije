export { ApiError, parseApiErrorBody } from './api/api-error.js'
export { fetchJson } from './api/fetch-json.js'
export { resolveFetchUrl } from './api/resolve-fetch-url.js'
export { formatListDate } from './utils/format-list-date.js'
export { claimDetailPath, type ClaimDetailLink } from './utils/claim-detail-path.js'
export { formatClaimDetailMetaLine } from './utils/format-claim-detail-meta-line.js'
export {
  detectAttachmentMimeType,
  extensionForMimeType,
  isAllowedAttachmentMimeType,
  isImageAttachmentMimeType,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  type AllowedAttachmentMimeType,
} from './utils/detect-attachment-mime.js'
export {
  AttachmentPreviewKind,
  formatAttachmentFileSize,
  getAttachmentPreviewKind,
  type AttachmentPreviewKind as AttachmentPreviewKindValue,
} from './utils/attachment-preview-kind.js'
export { formatListDateTime } from './utils/format-list-date-time.js'
export { formatEuroAmount } from './utils/format-euro-amount.js'
export { normalizeMrKey } from './utils/normalize-mr-key.js'
export { normalizeName, toAsciiDisplay } from './utils/normalize-name.js'
export { parseExcelDate } from './utils/parse-excel-date.js'
export {
  collapseManufacturerRowsForDisplay,
  computeManufacturerOutcomePercents,
  isStatisticsUnknownManufacturer,
  StatisticsManufacturerDisplaySegment,
  type ManufacturerOutcomePercents,
  type StatisticsManufacturerDisplayRow,
} from './utils/statistics-manufacturer-display.js'
export {
  CLAIM_REPORT_ALLOWED_ATTRIBUTES,
  CLAIM_REPORT_ALLOWED_STYLES,
  CLAIM_REPORT_ALLOWED_TAGS,
  CLAIM_REPORT_ATTACHMENT_ID_PATTERN,
  CLAIM_REPORT_ATTACHMENT_SRC_PATTERN,
  isAllowedClaimReportAttachmentSrc,
  isClaimReportEmpty,
  parseClaimReportAttachmentId,
} from './utils/claim-report-html-sanitize.js'

export * from './enums.js'
export * from './constants/outcome-colors.js'
export * from './constants/outcome-registry.js'
export * from './constants/kind-colors.js'
export * from './constants/kind-registry.js'
export * from './constants/statistics-manufacturer-colors.js'
export * from './queries/index.js'
export * from './permissions.js'
export * from './constants/roles.js'
export * from './constants/limits.js'
export * from './errors/codes.js'
export * from './schemas/reference-data.schema.js'
export * from './schemas/claim-fault.schema.js'
export * from './schemas/emotive-claim.schema.js'
export * from './schemas/domace-claim.schema.js'
export * from './schemas/claim-list.schema.js'
export * from './schemas/dashboard.schema.js'
export * from './schemas/statistics.schema.js'
export * from './schemas/excel-export.schema.js'
export * from './schemas/attachment.schema.js'
export * from './schemas/claim-report.schema.js'
export * from './constants/claim-report.js'
export * from './constants/claim-events.js'
export * from './constants/app-events.js'
export { THEME_BOOTSTRAP_SCRIPT, THEME_STORAGE_KEY } from './theme/theme-bootstrap-script.js'
