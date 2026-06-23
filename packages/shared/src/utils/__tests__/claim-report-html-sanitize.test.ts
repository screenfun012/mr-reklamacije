import { describe, expect, it } from 'vitest'

import {
  CLAIM_REPORT_ATTACHMENT_SRC_PATTERN,
  isAllowedClaimReportAttachmentSrc,
  isClaimReportEmpty,
} from '../claim-report-html-sanitize.js'

describe('isAllowedClaimReportAttachmentSrc', () => {
  it('allows relative attachment download URLs', () => {
    const attachmentId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde'
    expect(isAllowedClaimReportAttachmentSrc(`/api/attachments/${attachmentId}/download`)).toBe(
      true,
    )
    expect(
      CLAIM_REPORT_ATTACHMENT_SRC_PATTERN.test(`/api/attachments/${attachmentId}/download`),
    ).toBe(true)
  })

  it('blocks javascript, data and external image sources', () => {
    expect(isAllowedClaimReportAttachmentSrc('javascript:alert(1)')).toBe(false)
    expect(isAllowedClaimReportAttachmentSrc('data:image/png;base64,abc')).toBe(false)
    expect(isAllowedClaimReportAttachmentSrc('https://evil.example/image.png')).toBe(false)
  })
})

describe('isClaimReportEmpty', () => {
  it('treats default empty HTML as empty', () => {
    expect(isClaimReportEmpty('<p></p>')).toBe(true)
    expect(isClaimReportEmpty('  <p></p>  ')).toBe(true)
    expect(isClaimReportEmpty('<p><br></p>')).toBe(true)
  })

  it('treats documents with text as non-empty', () => {
    expect(isClaimReportEmpty('<p>Test izveštaj</p>')).toBe(false)
  })
})
