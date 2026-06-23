import htmlToDocxModule from '@turbodocx/html-to-docx'
import { describe, expect, it } from 'vitest'

import { renderClaimReportDocx, resolveHtmlToDocxModule } from '../claim-report-export-docx.js'

type HtmlToDocxFn = typeof import('@turbodocx/html-to-docx')

const htmlToDocxImport = htmlToDocxModule as HtmlToDocxFn | { default: HtmlToDocxFn }

describe('renderClaimReportDocx', () => {
  it('resolves @turbodocx/html-to-docx to a callable function under ESM interop', () => {
    const converter = resolveHtmlToDocxModule(htmlToDocxImport)

    expect(typeof converter).toBe('function')
  })

  it('returns a docx buffer for simple html through the same import path as dev', async () => {
    const buffer = await renderClaimReportDocx('<p>Test izveštaj</p>')

    expect(buffer.byteLength).toBeGreaterThan(100)
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK')
  })
})
