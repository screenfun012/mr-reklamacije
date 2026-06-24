import { AttachmentPurpose, ClaimKind } from '@mr/shared'

import type { ReportImageReadPort } from '../../core/ports/report-image-read-port.js'
import type { StorageService } from '../../infrastructure/storage/storage.interface.js'
import type { AttachmentsRepository } from './attachments.repository.js'

export class ReportImageReadAdapter implements ReportImageReadPort {
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
