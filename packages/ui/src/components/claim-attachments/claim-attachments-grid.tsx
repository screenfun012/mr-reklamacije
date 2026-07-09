import type { AttachmentListItem } from '@mr/shared'
import {
  AttachmentPreviewKind,
  buildAttachmentThumbnailUrl,
  formatAttachmentFileSize,
  getAttachmentPreviewKind,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Trash2 } from 'lucide-react'

import { cn } from '../../lib/cn.js'
import { Button } from '../../primitives/button.js'
import { AttachmentFileIcon } from './attachment-file-icon.js'

// ponytail: the claim-attachments components are internal-web-only and styled
// with internal's --mri-* tokens. If admin/portal ever import them, hoist those
// tokens to @mr/tailwind-preset first (see internal-web globals.css TODO) —
// otherwise they render unstyled there.
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

  // ~400px server-generated thumbnail; the endpoint falls back to the
  // original when none exists, so no client-side branching is needed.
  return buildAttachmentThumbnailUrl(item.id)
}

export function ClaimAttachmentsGrid({
  items,
  canDelete,
  onOpen,
  onDelete,
}: ClaimAttachmentsGridProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className="text-sm text-mri-text2" data-testid="claim-attachments-empty">
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
                'relative aspect-square overflow-hidden rounded-lg border border-mri-border bg-mri-inbg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mri-red',
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
                  <AttachmentFileIcon mimeType={item.mimeType} className="size-10 text-mri-text2" />
                  <span className="line-clamp-2 text-center text-xs text-mri-text2">
                    {item.fileName}
                  </span>
                </span>
              )}
            </button>

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-mri-text" title={item.fileName}>
                  {item.fileName}
                </p>
                <p className="text-xs text-mri-text2">
                  {formatAttachmentFileSize(item.fileSizeBytes)}
                </p>
              </div>

              {deletable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-mri-text2 hover:text-mri-bad"
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
