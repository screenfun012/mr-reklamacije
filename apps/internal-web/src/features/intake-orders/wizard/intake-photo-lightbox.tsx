import { m } from '@mr/i18n'
import { buildIntakePhotoUrl } from '@mr/shared'
import type { ReactElement } from 'react'

import type { IntakePhotoCell } from './intake-photo-grid'

export interface IntakePhotoLightboxProps {
  cell: IntakePhotoCell
  /** Null while the order has not been created yet — the local preview is all there is. */
  orderId: string | null
  onClose: () => void
  /**
   * Omitted where the photo may not be removed. The whole removal is the caller's, because on the
   * wizard it is two things at once: the file the server holds AND the queue entry that produced
   * it. Handing the lightbox only an attachment id would strand a landed upload in the queue.
   */
  onDelete?: () => void | Promise<void>
}

/**
 * Tap opens the photo; deleting it is a button inside that view. Nikola's call, 2026-07-27 —
 * the prototype and the printed instruction both delete on the first tap, and one gloved
 * finger on the wrong cell would destroy evidence of damage the customer has not yet signed
 * for. The divergence from the printed instruction is reported, not hidden.
 */
export function IntakePhotoLightbox({
  cell,
  orderId,
  onClose,
  onDelete,
}: IntakePhotoLightboxProps): ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={m.intake_photo_preview()}
      className="mri-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[rgba(11,11,13,0.92)] p-6"
      onClick={onClose}
    >
      {/* The grid deliberately loads thumbnails; the preview is the one place worth the full
          image, and only once the server actually has it. */}
      <img
        src={
          cell.attachmentId !== null && orderId !== null
            ? buildIntakePhotoUrl(orderId, cell.attachmentId)
            : cell.url
        }
        alt=""
        className="max-h-[78vh] max-w-full rounded-xl object-contain ring-1 ring-inset ring-mri-border2"
      />
      <div className="flex gap-3" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="h-12 cursor-pointer rounded-[11px] border border-mri-border2 bg-mri-inbg px-6 text-sm font-semibold text-mri-text"
        >
          {m.action_close()}
        </button>
        {onDelete !== undefined ? (
          <button
            type="button"
            onClick={() => void onDelete()}
            className="h-12 cursor-pointer rounded-[11px] border border-mri-red bg-[rgba(237,28,36,0.13)] px-6 text-sm font-extrabold uppercase tracking-[0.06em] text-mri-redh"
          >
            {m.intake_photo_delete()}
          </button>
        ) : null}
      </div>
    </div>
  )
}
