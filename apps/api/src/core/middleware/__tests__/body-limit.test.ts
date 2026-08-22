import { describe, expect, it } from 'vitest'

import { isUploadPath } from '../body-limit.js'

/**
 * A route that falls to the 2 MB default when it carries files fails only for the big uploads —
 * a compressed photo sails through and the bug ships. `/api/intake-orders/:id/photos` did exactly
 * that until 2026-07-27.
 */
describe('body limit — which paths get the upload window', () => {
  it('gives the upload window to every route that carries files', () => {
    expect(isUploadPath('/api/attachments/upload')).toBe(true)
    expect(isUploadPath('/api/claim-reports/images')).toBe(true)
    expect(
      isUploadPath('/api/client-submissions/0f5a1c2e-6d3b-4a91-8f77-2c9d5b1e4a30/attachments'),
    ).toBe(true)
    expect(isUploadPath('/api/intake-orders/0f5a1c2e-6d3b-4a91-8f77-2c9d5b1e4a30/photos')).toBe(
      true,
    )
  })

  it('keeps every other route on the small default, including neighbours of the upload paths', () => {
    expect(isUploadPath('/api/intake-orders')).toBe(false)
    expect(isUploadPath('/api/intake-orders/0f5a1c2e-6d3b-4a91-8f77-2c9d5b1e4a30')).toBe(false)
    expect(isUploadPath('/api/intake-orders/0f5a1c2e-6d3b-4a91-8f77-2c9d5b1e4a30/sign')).toBe(false)
    expect(isUploadPath('/api/claims')).toBe(false)
  })

  it('does not hand the window to a photo-delete, which carries no body', () => {
    expect(
      isUploadPath('/api/intake-orders/0f5a1c2e-6d3b-4a91-8f77-2c9d5b1e4a30/photos/abc-123'),
    ).toBe(false)
  })
})

describe('the intake quote', () => {
  it('is an upload path, like the photos beside it', () => {
    // It is a file made in another program — a scanned A4 is routinely 2-8 MB and nothing on the
    // way in compresses it. Falling to the 2 MB default answered 413 with no size in the message.
    expect(isUploadPath('/api/intake-orders/2f1c4e6a-0a3f-4d2e-9c11-7b0c9e5b4a10/quote')).toBe(true)
  })
})
