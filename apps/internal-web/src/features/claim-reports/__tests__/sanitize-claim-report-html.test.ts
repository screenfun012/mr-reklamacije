import { describe, expect, it } from 'vitest'

import { sanitizeClaimReportHtml } from '../sanitize-claim-report-html.js'

const VALID_ATTACHMENT_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde'

describe('sanitizeClaimReportHtml', () => {
  it('removes script tags from report HTML', () => {
    const result = sanitizeClaimReportHtml('<p>Test</p><script>alert(1)</script>')

    expect(result).toBe('<p>Test</p>')
    expect(result).not.toContain('script')
  })

  it('removes images with javascript src', () => {
    const result = sanitizeClaimReportHtml('<p><img src="javascript:alert(1)" alt="x"></p>')

    expect(result).not.toContain('javascript:')
    expect(result).not.toMatch(/<img[^>]*src=/i)
  })

  it('keeps images with valid attachment download URLs', () => {
    const src = `/api/attachments/${VALID_ATTACHMENT_ID}/download`
    const result = sanitizeClaimReportHtml(`<p><img src="${src}" alt="Slika" width="400"></p>`)

    expect(result).toContain(`src="${src}"`)
    expect(result).toContain('alt="Slika"')
    expect(result).toContain('width="400"')
  })
})
