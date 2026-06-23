export const CLAIM_REPORT_EXPORT_FONT_FAMILY = "'Figtree', sans-serif"

export function buildClaimReportExportStyles(fontFaceCss: string): string {
  return `
${fontFaceCss}

@page {
  size: A4;
  margin: 20mm;
}

body {
  margin: 0;
  color: #000000;
  font-family: ${CLAIM_REPORT_EXPORT_FONT_FAMILY};
  font-size: 11pt;
  line-height: 1.6;
}

.claim-report-export-body {
  color: #000000;
  font-family: ${CLAIM_REPORT_EXPORT_FONT_FAMILY};
}

.claim-report-export-body *:not(img) {
  color: #000000;
}

.claim-report-export-body img {
  max-width: 100%;
  height: auto;
}

.claim-report-export-body h1 {
  font-size: 1.75rem;
  margin: 1.25rem 0 0.75rem;
}

.claim-report-export-body h2 {
  font-size: 1.35rem;
  margin: 1rem 0 0.5rem;
}

.claim-report-export-body h3 {
  font-size: 1.15rem;
  margin: 0.85rem 0 0.45rem;
}

.claim-report-export-body p {
  margin: 0.5rem 0;
}

.claim-report-export-body ul,
.claim-report-export-body ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.claim-report-export-body blockquote {
  margin: 0.75rem 0;
  padding-left: 1rem;
  border-left: 3px solid #d1d5db;
}

.claim-report-export-body hr {
  border: none;
  border-top: 1px solid #d1d5db;
  margin: 1rem 0;
}

.claim-report-export-body pre {
  background: #f3f4f6;
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
}
`.trim()
}

export function wrapClaimReportExportHtml(bodyHtml: string, fontFaceCss: string): string {
  return `<!DOCTYPE html>
<html lang="sr">
  <head>
    <meta charset="utf-8" />
    <style>${buildClaimReportExportStyles(fontFaceCss)}</style>
  </head>
  <body>
    <div class="claim-report-export-body">${bodyHtml}</div>
  </body>
</html>`
}

export function wrapClaimReportExportBodyForDocx(bodyHtml: string): string {
  return `<div style="font-family: Figtree, sans-serif; color: #000000;">${bodyHtml}</div>`
}
