import { AttachmentPurpose, ClaimKind } from '@mr/shared'

import type { StorageService } from '../../infrastructure/storage/storage.interface.js'
import type { AttachmentsRepository } from '../attachments/attachments.repository.js'
import type { ClaimReportImageLoader } from './hydrate-claim-report-images.js'

export class ClaimReportImageLoaderImpl implements ClaimReportImageLoader {
  constructor(
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly storage: StorageService,
  ) {}

  async loadReportImage(input: {
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace
    claimId: string
    attachmentId: string
  }): Promise<{ data: Buffer; mimeType: string } | null> {
    const row = await this.attachmentsRepository.findRawById(input.attachmentId)
    if (row === null) {
      return null
    }

    if (row.purpose !== AttachmentPurpose.ReportImage) {
      return null
    }

    if (row.claimKind !== input.claimKind) {
      return null
    }

    const rowClaimId = row.emotiveClaimId ?? row.domaceClaimId
    if (rowClaimId !== input.claimId) {
      return null
    }

    const data = await this.storage.read(row.storagePath)
    return { data, mimeType: row.mimeType }
  }
}
