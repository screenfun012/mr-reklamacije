import { ClaimKind } from '@mr/shared'
import { describe, expect, it, vi } from 'vitest'

import type { ReportImageReadPort } from '../../../core/ports/report-image-read-port.js'
import { hydrateClaimReportImages } from '../hydrate-claim-report-images.js'

const ATTACHMENT_ID = '11111111-1111-4111-8111-111111111111'
const ATTACHMENT_SRC = `/api/attachments/${ATTACHMENT_ID}/download`

function createLoader(impl: ReportImageReadPort['loadReportImage']): ReportImageReadPort {
  return { loadReportImage: vi.fn(impl) }
}

describe('hydrateClaimReportImages', () => {
  it('returns html unchanged when there are no images', async () => {
    const html = '<p>Samo tekst</p>'
    const loader = createLoader(async () => null)

    const result = await hydrateClaimReportImages(
      html,
      { claimKind: ClaimKind.Domace, claimId: '22222222-2222-4222-8222-222222222222' },
      loader,
    )

    expect(result).toBe(html)
    expect(loader.loadReportImage).not.toHaveBeenCalled()
  })

  it('replaces attachment src with a base64 data URL', async () => {
    const html = `<p>Tekst</p><img src="${ATTACHMENT_SRC}" alt="Slika" width="320" />`
    const loader = createLoader(async () => ({
      data: Buffer.from('fake-image'),
      mimeType: 'image/jpeg',
    }))

    const result = await hydrateClaimReportImages(
      html,
      { claimKind: ClaimKind.Domace, claimId: '22222222-2222-4222-8222-222222222222' },
      loader,
    )

    expect(result).toContain('data:image/jpeg;base64,')
    expect(result).not.toContain(ATTACHMENT_SRC)
    expect(loader.loadReportImage).toHaveBeenCalledWith({
      claimKind: ClaimKind.Domace,
      claimId: '22222222-2222-4222-8222-222222222222',
      attachmentId: ATTACHMENT_ID,
    })
  })

  it('removes image tags when loader returns null', async () => {
    const html = `<p>Tekst</p><img src="${ATTACHMENT_SRC}" alt="Slika" />`
    const loader = createLoader(async () => null)

    const result = await hydrateClaimReportImages(
      html,
      { claimKind: ClaimKind.Emotive, claimId: '33333333-3333-4333-8333-333333333333' },
      loader,
    )

    expect(result).toBe('<p>Tekst</p>')
  })

  it('ignores external image URLs', async () => {
    const html = '<img src="https://example.com/evil.png" alt="x" />'
    const loader = createLoader(async () => ({
      data: Buffer.from('x'),
      mimeType: 'image/png',
    }))

    const result = await hydrateClaimReportImages(
      html,
      { claimKind: ClaimKind.Domace, claimId: '22222222-2222-4222-8222-222222222222' },
      loader,
    )

    expect(result).toBe(html)
    expect(loader.loadReportImage).not.toHaveBeenCalled()
  })
})
