import { describe, expect, it } from 'vitest'

import { getClaimReportExportFontFaceCss } from '../claim-report-export-font.js'
import {
  CLAIM_REPORT_EXPORT_FONT_FAMILY,
  wrapClaimReportExportHtml,
} from '../claim-report-export-styles.js'

const document = async (): Promise<string> =>
  wrapClaimReportExportHtml(
    '<p>Šipak, čačkalica, džem.</p>',
    await getClaimReportExportFontFaceCss(),
  )

/**
 * The `@font-face` rules only. Finding a family NAME somewhere in the document proves nothing — the
 * wrapper writes it into every `font-family` declaration it emits — so an assertion that greps the
 * whole page passes with the font entirely absent.
 */
function embeddedFaces(html: string): { family: string; block: string }[] {
  return [...html.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => {
    const block = match[1] ?? ''
    return { family: /font-family:\s*'([^']+)'/.exec(block)?.[1] ?? '', block }
  })
}

describe('the claim report Chromium is handed', () => {
  it('carries every font as bytes, with nothing left pointing at a file', async () => {
    const html = await document()
    const faces = embeddedFaces(html)

    expect(faces.length).toBeGreaterThan(0)
    for (const face of faces) {
      expect(face.block).toContain('url(data:font/woff2;base64,')
    }
    expect(html).not.toContain('./files/')
  })

  it('embeds the subset the Serbian letters live in', async () => {
    // U+0100-02BA is `latin-ext`, where č ć ž š đ are. Embedded as `latin` alone the page leaves no
    // hole — those five letters silently become whatever the container has, which on a slim Debian
    // image is Liberation Sans while the screen shows Figtree. That was this file's live defect.
    const faces = embeddedFaces(await document())

    expect(faces.filter((face) => face.block.includes('U+0100-02BA')).length).toBeGreaterThan(0)
  })

  it('asks for a family it actually declares', async () => {
    // The trap under the fix: fontsource names the family `Figtree Variable`, the wrapper used to
    // ask for `Figtree`. Swapping the embedding without this would have left NOTHING matching and
    // sent the whole report to the fallback — worse than the five letters it set out to repair.
    const faces = embeddedFaces(await document())
    const requested = CLAIM_REPORT_EXPORT_FONT_FAMILY.split(',')[0]?.trim().replaceAll("'", '')

    expect(faces.map((face) => face.family)).toContain(requested)
  })
})
