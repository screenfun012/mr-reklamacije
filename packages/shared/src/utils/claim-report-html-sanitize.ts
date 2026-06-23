import { DEFAULT_CLAIM_REPORT_CONTENT_HTML } from '../constants/claim-report.js'

/** Relative attachment download URLs embedded in report HTML. */
export const CLAIM_REPORT_ATTACHMENT_SRC_PATTERN =
  /^\/api\/attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/download$/i

export const CLAIM_REPORT_ALLOWED_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'img',
  'a',
  'strong',
  'em',
  'u',
  's',
  'code',
  'pre',
  'mark',
  'sub',
  'sup',
  'br',
  'span',
] as const

export const CLAIM_REPORT_ALLOWED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  span: ['style'],
  mark: ['style', 'data-color'],
  p: ['style'],
  h1: ['style'],
  h2: ['style'],
  h3: ['style'],
  h4: ['style'],
  li: ['style'],
  blockquote: ['style'],
}

export const CLAIM_REPORT_ALLOWED_STYLES: Readonly<Record<string, readonly RegExp[]>> = {
  '*': [
    /^text-align:\s*(left|center|right|justify)$/,
    /^background-color:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\))$/,
  ],
}

export function isAllowedClaimReportAttachmentSrc(src: string | undefined): boolean {
  if (src === undefined) {
    return false
  }

  const trimmed = src.trim()
  if (trimmed === '') {
    return false
  }

  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return false
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return false
  }

  return CLAIM_REPORT_ATTACHMENT_SRC_PATTERN.test(trimmed)
}

export function isClaimReportEmpty(contentHtml: string): boolean {
  const normalized = contentHtml.trim().replace(/\s+/g, ' ')
  if (normalized === '' || normalized === DEFAULT_CLAIM_REPORT_CONTENT_HTML) {
    return true
  }

  return (
    normalized === '<p><br></p>' || normalized === '<p><br/></p>' || normalized === '<p><br /></p>'
  )
}
