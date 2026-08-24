import { describe, expect, it } from 'vitest'

import { isUploadPath, maxBodyBytesFor, usesUploadLimit } from '../body-limit.js'

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

/**
 * The chat sends its text and its files through the SAME route, so the path alone can no longer
 * decide. Deciding on the path would have raised the module's most common POST — an ordinary
 * message — from 2 MB to 130 MB, removing the layer that keeps one authenticated caller from
 * exhausting the heap.
 */
describe('the upload window needs a multipart body, not just a path', () => {
  const chat = '/api/chat/conversations/2f1c4e6a-0a3f-4d2e-9c11-7b0c9e5b4a10/messages'

  it('opens for a multipart body on an upload path', () => {
    expect(usesUploadLimit(chat, 'multipart/form-data; boundary=----x')).toBe(true)
    expect(usesUploadLimit('/api/attachments/upload', 'multipart/form-data; boundary=y')).toBe(true)
  })

  it('stays shut for a JSON body on the very same path', () => {
    expect(usesUploadLimit(chat, 'application/json')).toBe(false)
  })

  it('stays shut when the header is missing altogether', () => {
    expect(usesUploadLimit(chat, undefined)).toBe(false)
  })

  it('stays shut for a multipart body on a path that carries no files', () => {
    expect(usesUploadLimit('/api/claims', 'multipart/form-data; boundary=z')).toBe(false)
  })
})

/**
 * How much a single request may buffer before anything reads it.
 *
 * ⚠ This is a MEMORY limit, not a policy. Measured on Node 24 against the chat route: five 25 MB
 * PDFs take the process from 42 MB to 708 MB of RSS. The API idles at 150–180 MB, runs as ONE
 * process, and carries claims, intake and the portal — so that is not a slow request, it is the
 * whole service falling over, reachable by anybody with an internal account from a phone.
 */
describe('the chat buffers far less than a claim attachment', () => {
  const chat = '/api/chat/conversations/2f1c4e6a-0a3f-4d2e-9c11-7b0c9e5b4a10/messages'
  const multipart = 'multipart/form-data; boundary=----x'
  const MB = 1024 * 1024

  it('gives the chat its own, much smaller window', () => {
    const chatWindow = maxBodyBytesFor(chat, multipart)
    const claimWindow = maxBodyBytesFor('/api/attachments/upload', multipart)

    expect(chatWindow).toBe(35 * MB)
    // A claim attachment may legitimately be a 25 MB video; a chat file is a photo or a scan.
    expect(chatWindow).toBeLessThan(claimWindow)
  })

  it('still keeps an ordinary chat message on the small default', () => {
    expect(maxBodyBytesFor(chat, 'application/json')).toBe(2 * MB)
  })

  it('leaves every other upload path exactly as it was', () => {
    expect(maxBodyBytesFor('/api/attachments/upload', multipart)).toBe(130 * MB)
    expect(
      maxBodyBytesFor('/api/intake-orders/2f1c4e6a-0a3f-4d2e-9c11-7b0c9e5b4a10/photos', multipart),
    ).toBe(130 * MB)
  })
})
