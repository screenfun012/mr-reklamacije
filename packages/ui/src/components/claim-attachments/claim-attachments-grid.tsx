import type { AttachmentListItem } from '@mr/shared'
import {
  AttachmentPreviewKind,
  buildAttachmentDownloadUrl,
  formatAttachmentFileSize,
  getAttachmentPreviewKind,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Trash2 } from 'lucide-react'

import { cn } from '../../lib/cn.js'
import { Button } from '../../primitives/button.js'
import { AttachmentFileIcon } from './attachment-file-icon.js'

export interface ClaimAttachmentsGridProps {
  items: readonly AttachmentListItem[]
  canDelete?: (item: AttachmentListItem) => boolean
  onOpen: (item: AttachmentListItem) => void
  onDelete: (item: AttachmentListItem) => void
}

function gridThumbnailUrl(item: AttachmentListItem): string | null {
  const kind = getAttachmentPreviewKind(item.mimeType)
  if (kind !== AttachmentPreviewKind.Image) {
    return null
  }

  if (item.thumbnailPath !== null) {
    return buildAttachmentDownloadUrl(item.id, 'inline')
  }

  return buildAttachmentDownloadUrl(item.id, 'inline')
}

export function ClaimAttachmentsGrid({
  items,
  canDelete,
  onOpen,
  onDelete,
}: ClaimAttachmentsGridProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="claim-attachments-empty">
        {m.claim_attachments_empty()}
      </p>
    )
  }

  return (
    <ul
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="claim-attachments-grid"
    >
      {items.map((item) => {
        const thumbnailUrl = gridThumbnailUrl(item)
        const deletable = canDelete?.(item) ?? false

        return (
          <li key={item.id} className="group flex flex-col gap-2">
            <button
              type="button"
              className={cn(
                'relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label={m.claim_attachments_grid_open()}
              onClick={() => onOpen(item)}
            >
              {thumbnailUrl !== null ? (
                <img
                  src={thumbnailUrl}
                  alt={item.fileName}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-2 p-3">
                  <AttachmentFileIcon
                    mimeType={item.mimeType}
                    className="size-10 text-muted-foreground"
                  />
                  <span className="line-clamp-2 text-center text-xs text-muted-foreground">
                    {item.fileName}
                  </span>
                </span>
              )}
            </button>

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={item.fileName}>
                  {item.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatAttachmentFileSize(item.fileSizeBytes)}
                </p>
              </div>

              {deletable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={m.claim_attachments_grid_delete()}
                  onClick={() => onDelete(item)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
