import {
  AttachmentPreviewKind,
  buildAttachmentDownloadUrl,
  formatAttachmentFileSize,
  getAttachmentPreviewKind,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn.js'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog.js'
import { Button } from '../../primitives/button.js'
import { AttachmentFileIcon } from './attachment-file-icon.js'

/**
 * Everything this dialog actually draws, and nothing else.
 *
 * ⚠ Deliberately NOT `AttachmentListItem`: that type demands a non-null `claimKind` and `claimId`,
 * which a file sent in a chat message has neither of. Nothing about the rendering here was ever
 * claim-specific — only the type and the URL builder were, and both are now the caller's to say.
 */
export interface PreviewableAttachment {
  id: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  caption: string | null
}

export interface AttachmentPreviewDialogProps<T extends PreviewableAttachment> {
  open: boolean
  onOpenChange: (open: boolean) => void
  attachment: T | null
  imageAttachments: readonly T[]
  onNavigate: (attachment: T) => void
  officePreview?: ReactNode
  /**
   * Where this attachment's bytes live. Defaults to the claim route, which is where every caller
   * but the chat reads from — the chat serves its files from its own module, because
   * `/api/attachments` is gated by a permission that opens every claim's files.
   */
  buildUrl?: (id: string, disposition: 'inline' | 'attachment') => string
}

const PREVIEW_DIALOG_CLASS = 'h-[85vh] max-h-[85vh] w-[min(90vw,1400px)] max-w-[min(90vw,1400px)]'

const PREVIEW_BODY_CLASS =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-mri-inbg px-4 py-4 sm:px-6'

export function AttachmentPreviewDialog<T extends PreviewableAttachment>({
  open,
  onOpenChange,
  attachment,
  imageAttachments,
  onNavigate,
  officePreview,
  buildUrl = buildAttachmentDownloadUrl,
}: AttachmentPreviewDialogProps<T>): React.ReactElement {
  if (attachment === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent wide hideClose className={PREVIEW_DIALOG_CLASS} />
      </Dialog>
    )
  }

  const previewKind = getAttachmentPreviewKind(attachment.mimeType)
  const downloadUrl = buildUrl(attachment.id, 'attachment')
  const inlineUrl = buildUrl(attachment.id, 'inline')
  const downloadLabel = m.claim_attachments_preview_download()

  const imageIndex = imageAttachments.findIndex((item) => item.id === attachment.id)
  const hasPrev = previewKind === AttachmentPreviewKind.Image && imageIndex > 0
  const hasNext =
    previewKind === AttachmentPreviewKind.Image &&
    imageIndex >= 0 &&
    imageIndex < imageAttachments.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide hideClose className={PREVIEW_DIALOG_CLASS}>
        <DialogHeader className="shrink-0 space-y-0 border-b border-mri-border px-4 py-3 text-left sm:px-6 sm:py-4">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
            <div className="min-w-0 overflow-hidden">
              <DialogTitle className="truncate">{attachment.fileName}</DialogTitle>
              <DialogDescription className="mt-1 truncate">
                {formatAttachmentFileSize(attachment.fileSizeBytes)}
                {attachment.caption ? ` · ${attachment.caption}` : ''}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <a href={downloadUrl} download={attachment.fileName} aria-label={downloadLabel}>
                  <Download className="size-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{downloadLabel}</span>
                </a>
              </Button>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Close"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div
          className={cn(
            PREVIEW_BODY_CLASS,
            previewKind === AttachmentPreviewKind.Pdf && 'px-0 py-0 sm:px-0 sm:py-0',
          )}
        >
          {previewKind === AttachmentPreviewKind.Image ? (
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              <img
                src={inlineUrl}
                alt={attachment.fileName}
                className="max-h-full max-w-full object-contain"
              />
              {hasPrev ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-1/2 left-0 -translate-y-1/2 sm:left-2"
                  aria-label={m.claim_attachments_preview_prev()}
                  onClick={() => {
                    const prev = imageAttachments[imageIndex - 1]
                    if (prev !== undefined) {
                      onNavigate(prev)
                    }
                  }}
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </Button>
              ) : null}
              {hasNext ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-1/2 right-0 -translate-y-1/2 sm:right-2"
                  aria-label={m.claim_attachments_preview_next()}
                  onClick={() => {
                    const next = imageAttachments[imageIndex + 1]
                    if (next !== undefined) {
                      onNavigate(next)
                    }
                  }}
                >
                  <ChevronRight className="size-5" aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : null}

          {previewKind === AttachmentPreviewKind.Pdf ? (
            <div className="relative min-h-0 w-full flex-1">
              <iframe
                src={inlineUrl}
                title={attachment.fileName}
                className="absolute inset-0 size-full border-0 bg-mri-surface"
              />
            </div>
          ) : null}

          {previewKind === AttachmentPreviewKind.Video ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <video
                src={inlineUrl}
                controls
                className="max-h-full w-full max-w-full object-contain rounded-md bg-black"
              >
                <track kind="captions" />
              </video>
            </div>
          ) : null}

          {previewKind === AttachmentPreviewKind.Office ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {officePreview ?? (
                <div className="flex max-w-md flex-col items-center gap-4 self-center rounded-lg border border-mri-border bg-mri-surface p-8 text-center">
                  <AttachmentFileIcon
                    mimeType={attachment.mimeType}
                    className="size-16 text-mri-text2"
                  />
                  <p className="text-sm text-mri-text2">
                    {m.claim_attachments_preview_unsupported()}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {previewKind === AttachmentPreviewKind.Unknown ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border border-mri-border bg-mri-surface p-8 text-center">
                <AttachmentFileIcon
                  mimeType={attachment.mimeType}
                  className="size-16 text-mri-text2"
                />
                <p className="text-sm text-mri-text2">
                  {m.claim_attachments_preview_unsupported()}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
