import {
  AttachmentPreviewKind,
  buildClientSubmissionAttachmentDownloadUrl,
  buildClientSubmissionAttachmentThumbnailUrl,
  clientSubmissionAttachmentsOptions,
  formatAttachmentFileSize,
  getAttachmentPreviewKind,
  type ClientSubmissionAttachmentItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { useSuspenseQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'

export interface SubmissionAttachmentsProps {
  submissionId: string
}

/**
 * Client-submitted photos/documents. Images render as thumbnails opening the
 * full file inline in a new tab; documents render as download cards. Read-only —
 * the employee cannot edit a client's attachments here (they carry over on convert).
 */
export function SubmissionAttachments({
  submissionId,
}: SubmissionAttachmentsProps): React.ReactElement {
  const { data } = useSuspenseQuery(clientSubmissionAttachmentsOptions(submissionId))

  if (data.items.length === 0) {
    return (
      <p className="text-sm italic text-mri-text2">{m.internal_inbox_detail_no_attachments()}</p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {data.items.map((item) => (
        <SubmissionAttachmentCard key={item.id} submissionId={submissionId} item={item} />
      ))}
    </div>
  )
}

function SubmissionAttachmentCard({
  submissionId,
  item,
}: {
  submissionId: string
  item: ClientSubmissionAttachmentItem
}): React.ReactElement {
  const isImage = getAttachmentPreviewKind(item.mimeType) === AttachmentPreviewKind.Image

  if (isImage) {
    return (
      <a
        href={buildClientSubmissionAttachmentDownloadUrl(submissionId, item.id)}
        target="_blank"
        rel="noreferrer"
        className="group block overflow-hidden rounded-[10px] border border-mri-border bg-mri-inbg transition-colors hover:border-mri-red"
      >
        <img
          src={buildClientSubmissionAttachmentThumbnailUrl(submissionId, item.id)}
          alt={item.fileName}
          loading="lazy"
          className="aspect-square w-full object-cover"
        />
      </a>
    )
  }

  return (
    <a
      href={buildClientSubmissionAttachmentDownloadUrl(submissionId, item.id, 'attachment')}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[10px] border border-mri-border bg-mri-inbg p-3 text-center transition-colors hover:border-mri-red"
    >
      <FileText className="size-7 flex-none text-mri-text2" aria-hidden="true" />
      <span className="line-clamp-2 break-all text-[12px] font-medium text-mri-text">
        {item.fileName}
      </span>
      <span className="font-mono text-[10px] text-mri-text2">
        {formatAttachmentFileSize(item.fileSizeBytes)}
      </span>
    </a>
  )
}
