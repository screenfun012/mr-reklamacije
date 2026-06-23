import htmlToDocxModule from '@turbodocx/html-to-docx'

import { wrapClaimReportExportBodyForDocx } from './claim-report-export-styles.js'

type HtmlToDocxFn = typeof import('@turbodocx/html-to-docx')

/** Handles ESM default interop when the package namespace is `{ default: fn }`. */
export function resolveHtmlToDocxModule(
  mod: HtmlToDocxFn | { default: HtmlToDocxFn },
): HtmlToDocxFn {
  if (typeof mod === 'function') {
    return mod
  }

  return mod.default
}

const HtmlToDocx = resolveHtmlToDocxModule(
  htmlToDocxModule as HtmlToDocxFn | { default: HtmlToDocxFn },
)

export async function renderClaimReportDocx(html: string): Promise<Buffer> {
  const docx = await HtmlToDocx(wrapClaimReportExportBodyForDocx(html), null, {
    footer: false,
    header: false,
    pageNumber: false,
    skipFirstHeaderFooter: true,
    font: 'Figtree',
    fontSize: 22,
    table: {
      row: {
        cantSplit: true,
      },
    },
  })

  return Buffer.from(docx as ArrayBuffer)
}
