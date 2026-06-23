import { MAX_REPORT_IMAGE_WIDTH } from '@mr/shared'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { optimizeReportImage } from '../attachment-image-processing.js'

async function createTestJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer()
}

async function createTestWebp(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 50, g: 100, b: 200 },
    },
  })
    .webp({ quality: 95 })
    .toBuffer()
}

describe('optimizeReportImage', () => {
  it('resizes a 3000×2000 JPEG to max width 1920 and reduces byte size', async () => {
    const original = await createTestJpeg(3000, 2000)

    const optimized = await optimizeReportImage(original, 'image/jpeg')

    expect(optimized.mimeType).toBe('image/jpeg')
    expect(optimized.width).toBeLessThanOrEqual(MAX_REPORT_IMAGE_WIDTH)
    expect(optimized.height).toBeLessThan(2000)
    expect(optimized.data.byteLength).toBeLessThan(original.byteLength)

    const metadata = await sharp(optimized.data).metadata()
    expect(metadata.width).toBeLessThanOrEqual(MAX_REPORT_IMAGE_WIDTH)
    expect(metadata.format).toBe('jpeg')
  })

  it('converts PNG upload to JPEG at quality 80', async () => {
    const original = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer()

    const optimized = await optimizeReportImage(original, 'image/png')

    expect(optimized.mimeType).toBe('image/jpeg')
    expect(optimized.width).toBeLessThanOrEqual(MAX_REPORT_IMAGE_WIDTH)
    expect(optimized.data.byteLength).toBeLessThan(original.byteLength)
  })

  it('keeps WebP output for WebP uploads at quality 80', async () => {
    const original = await createTestWebp(2500, 1500)

    const optimized = await optimizeReportImage(original, 'image/webp')

    expect(optimized.mimeType).toBe('image/webp')
    expect(optimized.width).toBeLessThanOrEqual(MAX_REPORT_IMAGE_WIDTH)

    const metadata = await sharp(optimized.data).metadata()
    expect(metadata.format).toBe('webp')
  })

  it('does not enlarge small images', async () => {
    const original = await createTestJpeg(800, 600)

    const optimized = await optimizeReportImage(original, 'image/jpeg')

    expect(optimized.width).toBe(800)
    expect(optimized.height).toBe(600)
  })
})
