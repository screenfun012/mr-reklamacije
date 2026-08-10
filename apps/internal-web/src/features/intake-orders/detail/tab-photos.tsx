import { m } from '@mr/i18n'
import { deleteIntakeOrderPhoto, intakeOrderKeys, type IntakeOrderDetail } from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type ReactElement } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { buildPhotoCells, type IntakePhotoCell } from '../wizard/intake-photo-grid'
import { IntakePhotoCellOverlay, photoCellBorderClass } from '../wizard/intake-photo-cell-state'
import { IntakePhotoLightbox } from '../wizard/intake-photo-lightbox'
import { useIntakePhotoPicker } from '../wizard/intake-photo-picker'
import type { IntakePhotoQueue } from '../wizard/use-intake-photo-queue'
import { CAPTION, CARD } from './detail-styles'

/** `IMG_03` — the photo's position in the list, padded, as the prototype names them (`:1443`). */
function photoName(index: number): string {
  return `IMG_${String(index + 1).padStart(2, '0')}`
}

/**
 * The whole photo documentation, four across (prototype 597–613), plus — for whoever may amend —
 * a `+` cell and a delete inside the photo view. Both actions are immediate and confirmed once;
 * they are deliberately OUTSIDE the Pregled tab's edit mode, because a photo is not part of a
 * buffer that "Otkaži" could take back (decision ④).
 *
 * No "not every photo arrived" bar either: that warning ships once, page-level under the header,
 * where all four tabs can see it (`intake-photos-pending-note.tsx`).
 */
export function TabPhotos({
  order,
  queue,
  canAddPhotos,
  isOrderTechnician,
}: {
  order: IntakeOrderDetail
  /** Owned by the PAGE: a tab change unmounts this body, and an upload must survive it. */
  queue: IntakePhotoQueue
  /** `amend` AND `update`, on a signed and not-removed order — the route demands both. */
  canAddPhotos: boolean
  /**
   * The server treats a late arrival from the order's OWN technician as part of the intake and
   * stamps nothing, so the dialog must not promise a permanent mark to the one person it never
   * happens to.
   */
  isOrderTechnician: boolean
}): ReactElement {
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<IntakePhotoCell | null>(null)
  const [confirmAdd, setConfirmAdd] = useState(false)
  const [deleting, setDeleting] = useState<IntakePhotoCell | null>(null)
  const [removing, setRemoving] = useState(false)

  const picker = useIntakePhotoPicker((files) => queue.enqueue(files, null))
  const cells = buildPhotoCells(order.id, order.photos, queue.entries, order.damages)

  const remove = async (cell: IntakePhotoCell): Promise<void> => {
    setRemoving(true)
    try {
      if (cell.attachmentId !== null) {
        await deleteIntakeOrderPhoto(order.id, cell.attachmentId)
      }
      // Two things, not one. The queue never clears a landed entry — the grid only HIDES it once
      // the server lists the photo, so the visible cell is the server's and carries no `entryId`
      // at all. Left alone, the entry surfaces again the moment the photo leaves the server list,
      // and the deleted photo returns as an upload in flight. So the entry is found by what it
      // produced, not by which cell was tapped.
      for (const entry of queue.entries) {
        const isThisPhoto =
          entry.id === cell.entryId ||
          (cell.attachmentId !== null && entry.attachmentId === cell.attachmentId)
        if (isThisPhoto) {
          queue.discard(entry.id)
        }
      }
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
      showInternalToast(m.intake_photo_deleted())
      setDeleting(null)
      setPreview(null)
    } catch {
      showInternalToast(m.intake_detail_action_failed())
    } finally {
      setRemoving(false)
    }
  }

  return (
    // The lightbox is a sibling of the card, never a child of a `@container`: containment makes
    // the container the containing block for `position: fixed` (see `tab-overview.tsx`).
    <>
      <section className={cn(CARD, 'flex flex-col gap-[14px] px-[22px] py-5')}>
        {/* The count sits inside the red caption, undimmed — unlike the Pregled card's `· N`,
            which greys it (prototype :599 against :562). */}
        <h2 className={CAPTION}>
          {m.intake_card_photo_documentation()} · {cells.length}
        </h2>

        {cells.length === 0 && !canAddPhotos ? (
          <p className="text-[13.5px] italic text-mri-text2">{m.intake_detail_no_photos()}</p>
        ) : (
          <div className="grid grid-cols-4 gap-[14px]">
            {cells.map((cell, index) => (
              <div key={cell.key} className="flex min-w-0 flex-col gap-[7px]">
                <button
                  type="button"
                  onClick={() => setPreview(cell)}
                  aria-label={m.intake_photo_preview()}
                  className={cn(
                    'relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-[10px] border bg-mri-inbg',
                    photoCellBorderClass(cell.state),
                  )}
                >
                  <img src={cell.url} alt="" className="size-full object-cover" />
                  {cell.number !== null && cell.numberColour !== null ? (
                    <span
                      className="absolute left-[6px] top-[6px] grid size-[22px] place-items-center rounded-full font-mono text-[11px] font-bold"
                      style={{ background: cell.numberColour.fill, color: cell.numberColour.text }}
                    >
                      {cell.number}
                    </span>
                  ) : null}
                  <IntakePhotoCellOverlay cell={cell} />
                </button>

                <span className="font-mono text-[10.5px] font-medium text-mri-text2">
                  {cell.number === null
                    ? photoName(index)
                    : m.intake_photo_caption_damage({
                        photo: photoName(index),
                        number: cell.number,
                      })}
                </span>
              </div>
            ))}

            {canAddPhotos ? (
              <button
                type="button"
                onClick={() => setConfirmAdd(true)}
                aria-label={m.intake_photo_add()}
                className="grid aspect-[4/3] cursor-pointer place-items-center rounded-[10px] border border-dashed border-mri-border2 text-mri-text2 transition-colors duration-200 hover:border-mri-red hover:text-mri-redh motion-reduce:transition-none"
              >
                <Plus className="size-6" strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        )}
      </section>

      {picker.inputs}

      {/* Asked BEFORE the picker opens, because the stamp is what the operator is agreeing to —
          not the file choice, which he can still cancel in his own file dialog. */}
      <ConfirmDialog
        open={confirmAdd}
        onOpenChange={setConfirmAdd}
        variant="default"
        title={m.intake_photo_add_title({ number: order.orderNumber })}
        description={
          isOrderTechnician
            ? m.intake_photo_add_description()
            : `${m.intake_photo_add_description()} ${m.intake_photo_add_stamp_warning()}`
        }
        confirmLabel={m.intake_photo_add_confirm()}
        onConfirm={() => {
          setConfirmAdd(false)
          picker.openCamera()
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
          }
        }}
        title={m.intake_photo_delete_title({ number: order.orderNumber })}
        description={m.intake_photo_delete_description()}
        confirmLabel={m.intake_photo_delete_confirm()}
        pending={removing}
        onConfirm={() => {
          if (deleting !== null) {
            void remove(deleting)
          }
        }}
      />

      {preview === null ? null : (
        <IntakePhotoLightbox
          cell={preview}
          orderId={order.id}
          onClose={() => setPreview(null)}
          {...(canAddPhotos ? { onDelete: () => setDeleting(preview) } : {})}
        />
      )}
    </>
  )
}
