import type { AttachmentListItem } from '@mr/shared'
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

export interface ClaimAttachmentPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attachment: AttachmentListItem | null
  imageAttachments: readonly AttachmentListItem[]
  onNavigate: (attachment: AttachmentListItem) => void
  officePreview?: ReactNode
}

const PREVIEW_DIALOG_CLASS =
  'flex h-[85vh] max-h-[85vh] w-[min(90vw,1400px)] flex-col gap-0 overflow-hidden p-0'

const PREVIEW_BODY_CLASS =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/20 px-4 py-4 sm:px-6'

const PREVIEW_FRAME_CLASS = 'min-h-0 w-full flex-1 rounded-md border border-border bg-background'

function buildPdfPreviewUrl(inlineUrl: string): string {
  return `${inlineUrl}#view=FitH`
}

export function ClaimAttachmentPreviewDialog({
  open,
  onOpenChange,
  attachment,
  imageAttachments,
  onNavigate,
  officePreview,
}: ClaimAttachmentPreviewDialogProps): React.ReactElement {
  if (attachment === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent hideClose className={PREVIEW_DIALOG_CLASS} />
      </Dialog>
    )
  }

  const previewKind = getAttachmentPreviewKind(attachment.mimeType)
  const downloadUrl = buildAttachmentDownloadUrl(attachment.id, 'attachment')
  const inlineUrl = buildAttachmentDownloadUrl(attachment.id, 'inline')
  const downloadLabel = m.claim_attachments_preview_download()

  const imageIndex = imageAttachments.findIndex((item) => item.id === attachment.id)
  const hasPrev = previewKind === AttachmentPreviewKind.Image && imageIndex > 0
  const hasNext =
    previewKind === AttachmentPreviewKind.Image &&
    imageIndex >= 0 &&
    imageIndex < imageAttachments.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className={PREVIEW_DIALOG_CLASS}>
        <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 py-3 text-left sm:px-6 sm:py-4">
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

        <div className={PREVIEW_BODY_CLASS}>
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
            <iframe
              src={buildPdfPreviewUrl(inlineUrl)}
              title={attachment.fileName}
              className={cn(PREVIEW_FRAME_CLASS, 'block')}
            />
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
                <div className="flex max-w-md flex-col items-center gap-4 self-center rounded-lg border border-border bg-background p-8 text-center">
                  <AttachmentFileIcon
                    mimeType={attachment.mimeType}
                    className="size-16 text-muted-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    {m.claim_attachments_preview_unsupported()}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {previewKind === AttachmentPreviewKind.Unknown ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-background p-8 text-center">
                <AttachmentFileIcon
                  mimeType={attachment.mimeType}
                  className="size-16 text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
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
