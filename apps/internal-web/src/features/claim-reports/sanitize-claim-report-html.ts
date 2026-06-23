import {
  CLAIM_REPORT_ALLOWED_ATTRIBUTES,
  CLAIM_REPORT_ALLOWED_TAGS,
  isAllowedClaimReportAttachmentSrc,
} from '@mr/shared'
import DOMPurify from 'isomorphic-dompurify'

let attachmentSrcHookRegistered = false

function ensureAttachmentSrcHook(): void {
  if (attachmentSrcHookRegistered) {
    return
  }

  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (node.tagName !== 'IMG' || data.attrName !== 'src') {
      return
    }

    if (!isAllowedClaimReportAttachmentSrc(data.attrValue)) {
      data.keepAttr = false
    }
  })

  attachmentSrcHookRegistered = true
}

function buildAllowedAttributes(): string[] {
  const attrs = new Set<string>()

  for (const tagAttrs of Object.values(CLAIM_REPORT_ALLOWED_ATTRIBUTES)) {
    for (const attr of tagAttrs) {
      attrs.add(attr)
    }
  }

  return [...attrs]
}

export function sanitizeClaimReportHtml(html: string): string {
  ensureAttachmentSrcHook()

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...CLAIM_REPORT_ALLOWED_TAGS],
    ALLOWED_ATTR: buildAllowedAttributes(),
    ALLOW_DATA_ATTR: false,
  })
}
