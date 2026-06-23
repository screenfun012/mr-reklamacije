import { describe, expect, it } from 'vitest'

import {
  detectAttachmentMimeType,
  extensionForMimeType,
  isAllowedAttachmentMimeType,
} from '../detect-attachment-mime.js'

describe('detectAttachmentMimeType', () => {
  it('detects jpeg, png, webp, and pdf magic bytes', () => {
    expect(detectAttachmentMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg')
    expect(
      detectAttachmentMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png')
    expect(
      detectAttachmentMimeType(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe('image/webp')
    expect(detectAttachmentMimeType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(
      'application/pdf',
    )
  })

  it('detects mp4 ftyp brands', () => {
    const mp4 = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ])
    expect(detectAttachmentMimeType(mp4)).toBe('video/mp4')
  })

  it('returns null for unknown bytes', () => {
    expect(detectAttachmentMimeType(new Uint8Array([0x00, 0x01, 0x02]))).toBeNull()
  })
})

describe('isAllowedAttachmentMimeType', () => {
  it('accepts documented allow-list values', () => {
    expect(isAllowedAttachmentMimeType('image/jpeg')).toBe(true)
    expect(isAllowedAttachmentMimeType('text/plain')).toBe(false)
  })
})

describe('extensionForMimeType', () => {
  it('maps supported mime types to file extensions', () => {
    expect(extensionForMimeType('application/pdf')).toBe('pdf')
    expect(extensionForMimeType('video/quicktime')).toBe('mov')
  })
})
