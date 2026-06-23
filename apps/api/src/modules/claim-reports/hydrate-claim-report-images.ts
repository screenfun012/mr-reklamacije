import {
  isAllowedClaimReportAttachmentSrc,
  parseClaimReportAttachmentId,
  type ClaimKind,
} from '@mr/shared'

const CLAIM_REPORT_IMG_TAG_PATTERN = /<img\b([^>]*?\bsrc=")([^"]+)("[^>]*?)>/gi

export interface ClaimReportImageLoader {
  loadReportImage(input: {
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace
    claimId: string
    attachmentId: string
  }): Promise<{ data: Buffer; mimeType: string } | null>
}

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
  loader: ClaimReportImageLoader,
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

    const hydratedTag = `<img${prefix}${toDataUrl(image.mimeType, image.data)}${suffix}>`
    result = result.replace(fullTag, hydratedTag)
  }

  return result
}
