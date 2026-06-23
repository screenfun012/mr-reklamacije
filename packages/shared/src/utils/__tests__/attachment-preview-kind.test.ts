import { describe, expect, it } from 'vitest'

import {
  AttachmentPreviewKind,
  formatAttachmentFileSize,
  getAttachmentPreviewKind,
} from '../attachment-preview-kind.js'

describe('getAttachmentPreviewKind', () => {
  it('classifies image MIME types', () => {
    expect(getAttachmentPreviewKind('image/jpeg')).toBe(AttachmentPreviewKind.Image)
    expect(getAttachmentPreviewKind('image/heic')).toBe(AttachmentPreviewKind.Image)
  })

  it('classifies PDF', () => {
    expect(getAttachmentPreviewKind('application/pdf')).toBe(AttachmentPreviewKind.Pdf)
  })

  it('classifies video MIME types', () => {
    expect(getAttachmentPreviewKind('video/mp4')).toBe(AttachmentPreviewKind.Video)
  })

  it('classifies Office documents', () => {
    expect(
      getAttachmentPreviewKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(AttachmentPreviewKind.Office)
  })
})

describe('formatAttachmentFileSize', () => {
  it('formats bytes, kilobytes, and megabytes', () => {
    expect(formatAttachmentFileSize(512)).toBe('512 B')
    expect(formatAttachmentFileSize(2048)).toBe('2.0 KB')
    expect(formatAttachmentFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
