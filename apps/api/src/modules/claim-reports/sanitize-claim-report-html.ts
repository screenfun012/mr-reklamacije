import {
  CLAIM_REPORT_ALLOWED_ATTRIBUTES,
  CLAIM_REPORT_ALLOWED_STYLES,
  CLAIM_REPORT_ALLOWED_TAGS,
  isAllowedClaimReportAttachmentSrc,
} from '@mr/shared'
import sanitizeHtml from 'sanitize-html'

function pickImageAttributes(attribs: Record<string, string>): Record<string, string> {
  const allowed: Record<string, string> = {}

  const src = attribs['src']
  if (src !== undefined) {
    allowed['src'] = src
  }

  const alt = attribs['alt']
  if (alt !== undefined) {
    allowed['alt'] = alt
  }

  const title = attribs['title']
  if (title !== undefined) {
    allowed['title'] = title
  }

  const width = attribs['width']
  if (width !== undefined) {
    allowed['width'] = width
  }

  const height = attribs['height']
  if (height !== undefined) {
    allowed['height'] = height
  }

  return allowed
}

export function sanitizeClaimReportHtml(html: string): string {
  const allowedStyles: Record<string, Record<string, RegExp[]>> = {}

  for (const [selector, patterns] of Object.entries(CLAIM_REPORT_ALLOWED_STYLES)) {
    allowedStyles[selector] = {
      '*': [...patterns],
    }
  }

  return sanitizeHtml(html, {
    allowedTags: [...CLAIM_REPORT_ALLOWED_TAGS],
    allowedAttributes: Object.fromEntries(
      Object.entries(CLAIM_REPORT_ALLOWED_ATTRIBUTES).map(([tag, attrs]) => [tag, [...attrs]]),
    ),
    allowedStyles,
    transformTags: {
      img: (_tagName, attribs) => {
        if (!isAllowedClaimReportAttachmentSrc(attribs['src'])) {
          return { tagName: 'span', attribs: {}, text: '' }
        }

        return {
          tagName: 'img',
          attribs: pickImageAttributes(attribs),
        }
      },
    },
  })
}
