import {
  isAllowedClaimReportAttachmentSrc,
  parseClaimReportAttachmentId,
  type ClaimKind,
} from '@mr/shared'

import type { ReportImageReadPort } from '../../core/ports/report-image-read-port.js'

const CLAIM_REPORT_IMG_TAG_PATTERN = /<img\b([^>]*?\bsrc=")([^"]+)("[^>]*?)>/gi

export interface ClaimReportImageContext {
  claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace
  claimId: string
}

function toDataUrl(mimeType: string, data: Buffer): string {
  return `data:${mimeType};base64,${data.toString('base64')}`
}

export async function hydrateClaimReportImages(
  html: string,
  context: ClaimReportImageContext,
  loader: ReportImageReadPort,
): Promise<string> {
  const matches = [...html.matchAll(CLAIM_REPORT_IMG_TAG_PATTERN)]
  if (matches.length === 0) {
    return html
  }

  let result = html

  for (const match of matches) {
    const fullTag = match[0]
    const prefix = match[1]
    const src = match[2]
    const suffix = match[3]

    if (src === undefined || !isAllowedClaimReportAttachmentSrc(src)) {
      continue
    }

    const attachmentId = parseClaimReportAttachmentId(src)
    if (attachmentId === null) {
      continue
    }

    const image = await loader.loadReportImage({
      claimKind: context.claimKind,
      claimId: context.claimId,
      attachmentId,
    })

    if (image === null) {
      result = result.replace(fullTag, '')
      continue
    }

    const dataUrl = toDataUrl(image.mimeType, image.data)
    result = result.replace(fullTag, `<img${prefix}${dataUrl}${suffix}>`)
  }

  return result
}
