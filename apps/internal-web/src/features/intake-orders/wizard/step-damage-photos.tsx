import { m } from '@mr/i18n'
import {
  IntakeDamageType,
  intakeDamageTypeValues,
  buildIntakePhotoUrl,
  intakeDamageZoneOf,
  type IntakeDamage,
  type IntakeOrderPhoto,
} from '@mr/shared'
import { ConfirmDialog, cn } from '@mr/ui'
import { Camera } from 'lucide-react'
import { useRef, useState, type ReactElement } from 'react'

import { IntakeDamageMap, intakeDamageMarkerColour } from './intake-damage-map'
import { IntakePanel } from './intake-panel'
import { buildPhotoCells, IntakePhotoGrid, type IntakePhotoCell } from './intake-photo-grid'
import { newDamageId, type IntakeWizardValues } from './intake-wizard-state'
import type { IntakePhotoQueue } from './use-intake-photo-queue'

const DAMAGE_TYPE_LABEL: Record<IntakeDamageType, () => string> = {
  [IntakeDamageType.Scratch]: () => m.intake_damage_type_ogrebotina(),
  [IntakeDamageType.Dent]: () => m.intake_damage_type_udubljenje(),
  [IntakeDamageType.Cracked]: () => m.intake_damage_type_puknuto(),
  [IntakeDamageType.Rust]: () => m.intake_damage_type_rdja(),
}

const VEHICLE_TYPE_LABEL = {
  auto: () => m.intake_vehicle_type_auto(),
  kombi: () => m.intake_vehicle_type_kombi(),
  kamionet: () => m.intake_vehicle_type_kamionet(),
  dzip: () => m.intake_vehicle_type_dzip(),
} as const

export interface StepDamagePhotosProps {
  values: IntakeWizardValues
  onPatch: (patch: Partial<IntakeWizardValues>) => void
  orderId: string | null
  photos: readonly IntakeOrderPhoto[]
  queue: IntakePhotoQueue
  /** Pushes the markers to the server and resolves once they are there. */
  onSaveDamages: () => Promise<void>
  onDeletePhoto: (attachmentId: string) => Promise<void>
}

/**
 * Step 3 — what the vehicle already looks like. A tap on the drawing drops a numbered marker of
 * the selected type; the list on the right is the same markers in the same order, and each row
 * can shoot a photo bound to its damage.
 */
export function StepDamagePhotos({
  values,
  onPatch,
  orderId,
  photos,
  queue,
  onSaveDamages,
  onDeletePhoto,
}: StepDamagePhotosProps): ReactElement {
  const [damageType, setDamageType] = useState<IntakeDamageType>(IntakeDamageType.Scratch)
  /**
   * The number is captured when the dialog opens, not looked up while it is on screen: the list
   * renumbers the moment the damage leaves it, and a dialog that reads the index live asks
   * "Obrisati oštećenje 0?" for the split second before it closes.
   */
  const [removing, setRemoving] = useState<{ damage: IntakeDamage; number: number } | null>(null)
  const [preview, setPreview] = useState<IntakePhotoCell | null>(null)

  const damageInputRef = useRef<HTMLInputElement>(null)
  const pendingDamageId = useRef<string | null>(null)

  const cells = buildPhotoCells(orderId, photos, queue.entries, values.damages)
  /** Cells carry the marker's NUMBER, which is its 1-based position in the list. */
  const photoCountOfNumber = (number: number): number =>
    cells.filter((cell) => cell.number === number).length

  const place = (point: { x: number; y: number }): void => {
    onPatch({
      damages: [
        ...values.damages,
        {
          id: newDamageId(),
          type: damageType,
          x: point.x,
          y: point.y,
          // The server derives the zone again and overwrites this, but the wire schema requires a
          // non-empty one, so a missing value fails in Zod before that ever runs.
          zone: intakeDamageZoneOf(values.vehicleType, point.x, point.y),
        },
      ],
    })
  }

  const remove = (damage: IntakeDamage): void => {
    onPatch({ damages: values.damages.filter((row) => row.id !== damage.id) })
    setRemoving(null)
  }

  /**
   * The server validates `damageId` against the markers it already holds, so a photo for a marker
   * that has only been tapped 400 ms ago is refused. Saving first is what makes ◉ SLIKAJ work on
   * a fresh marker instead of failing in a way the serviser cannot act on.
   */
  const shoot = (damageId: string): void => {
    void (async () => {
      await onSaveDamages()
      pendingDamageId.current = damageId
      damageInputRef.current?.click()
    })()
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <IntakePanel
        title={m.intake_card_damage_map()}
        headerClassName="gap-2.5"
        badge={
          <span className="rounded-full border border-mri-border2 bg-mri-inbg px-[9px] py-[3px] font-mono text-[9.5px] font-semibold tracking-[0.1em] text-mri-text2">
            {VEHICLE_TYPE_LABEL[values.vehicleType]()}
          </span>
        }
        action={<span className="text-[12.5px] text-mri-text2">{m.intake_map_hint()}</span>}
        className="min-w-0 flex-1 gap-[11px] px-5 py-[18px]"
      >
        <div className="grid min-h-0 flex-1 place-items-center rounded-xl border border-mri-border bg-mri-inbg p-2">
          <IntakeDamageMap
            vehicleType={values.vehicleType}
            damages={values.damages}
            onPlace={place}
          />
        </div>

        <div className="flex gap-2">
          {intakeDamageTypeValues.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setDamageType(type)}
              aria-pressed={damageType === type}
              className={cn(
                'h-12 flex-1 cursor-pointer rounded-[9px] border text-[13px] transition-colors duration-200 motion-reduce:transition-none',
                // The selected tint is red for every type — it deliberately does NOT preview the
                // marker's own colour, which would read as four different controls.
                damageType === type
                  ? 'border-[rgba(237,28,36,0.42)] bg-[rgba(237,28,36,0.13)] font-bold text-mri-redh'
                  : 'border-mri-border2 bg-mri-inbg font-semibold text-mri-text2',
              )}
            >
              {DAMAGE_TYPE_LABEL[type]()}
            </button>
          ))}
        </div>
      </IntakePanel>

      <div className="flex min-h-0 w-full flex-col gap-[14px] lg:w-[520px] lg:flex-none">
        <IntakePanel
          title={m.intake_card_damage_list()}
          action={
            <span className="rounded-full bg-[rgba(237,28,36,0.13)] px-2.5 py-[3px] font-mono text-[13px] font-bold text-mri-redh">
              {values.damages.length}
            </span>
          }
          className="flex-none gap-[9px] px-[18px] py-4"
        >
          {values.damages.map((damage, index) => {
            const colour = intakeDamageMarkerColour(damage.type)
            const shots = photoCountOfNumber(index + 1)
            return (
              <div
                key={damage.id}
                className="flex items-center gap-[11px] rounded-[10px] bg-mri-inbg px-2.5 py-2"
              >
                <span
                  className="grid size-[26px] flex-none place-items-center rounded-full font-mono text-xs font-bold"
                  style={{ background: colour.fill, color: colour.text }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  {m.intake_damage_row_label({
                    type: DAMAGE_TYPE_LABEL[damage.type](),
                    zone: damage.zone,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => shoot(damage.id)}
                  disabled={orderId === null}
                  className={cn(
                    'flex h-11 flex-none cursor-pointer items-center gap-[7px] rounded-[9px] border px-[13px] font-mono text-[11px] font-extrabold uppercase tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-40',
                    shots > 0
                      ? 'border-mri-border2 bg-mri-inbg text-mri-text2'
                      : 'border-mri-red bg-[rgba(237,28,36,0.13)] text-mri-redh',
                  )}
                >
                  <Camera className="size-[13px]" aria-hidden="true" />
                  {shots > 0 ? String(shots) : m.intake_photo_shoot()}
                </button>
                <button
                  type="button"
                  onClick={() => setRemoving({ damage, number: index + 1 })}
                  aria-label={m.intake_damage_remove()}
                  className="h-11 w-9 flex-none cursor-pointer text-base text-mri-text2"
                >
                  ✕
                </button>
              </div>
            )
          })}

          {values.damages.length === 0 ? (
            <p className="px-2.5 py-3 text-[13.5px] italic text-mri-text2">
              {m.intake_damage_empty()}
            </p>
          ) : null}
        </IntakePanel>

        <IntakePhotoGrid
          cells={cells}
          onPick={(files) => queue.enqueue(files, null)}
          onOpen={setPreview}
          onRetry={queue.retry}
        />
      </div>

      <input
        ref={damageInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={() => {
          const input = damageInputRef.current
          const files = input?.files
          if (files !== null && files !== undefined && files.length > 0) {
            queue.enqueue([...files], pendingDamageId.current)
          }
          pendingDamageId.current = null
          if (input !== null) {
            input.value = ''
          }
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={m.intake_damage_confirm_remove_title({ number: removing?.number ?? 0 })}
        description={m.intake_damage_confirm_remove_description()}
        confirmLabel={m.intake_damage_remove()}
        onConfirm={() => {
          if (removing !== null) {
            remove(removing.damage)
          }
        }}
      />

      {/*
        Tap opens the photo; deleting it is a button inside that view. Nikola's call, 2026-07-27 —
        the prototype and the printed instruction both delete on the first tap, and one gloved
        finger on the wrong cell would destroy evidence of damage the customer has not yet signed
        for. The divergence from the printed instruction is reported, not hidden.
      */}
      {preview !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={m.intake_photo_preview()}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[rgba(11,11,13,0.92)] p-6"
          onClick={() => setPreview(null)}
        >
          {/* The grid deliberately loads thumbnails; the preview is the one place worth the full
              image, and only once the server actually has it. */}
          <img
            src={
              preview.attachmentId !== null && orderId !== null
                ? buildIntakePhotoUrl(orderId, preview.attachmentId)
                : preview.url
            }
            alt=""
            className="max-h-[78vh] max-w-full rounded-xl object-contain"
          />
          <div className="flex gap-3" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="h-12 cursor-pointer rounded-[11px] border border-mri-border2 bg-mri-inbg px-6 text-sm font-semibold text-mri-text"
            >
              {m.action_close()}
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  if (preview.attachmentId !== null) {
                    await onDeletePhoto(preview.attachmentId)
                  }
                  if (preview.entryId !== null) {
                    queue.discard(preview.entryId)
                  }
                  setPreview(null)
                })()
              }}
              className="h-12 cursor-pointer rounded-[11px] border border-mri-red bg-[rgba(237,28,36,0.13)] px-6 text-sm font-extrabold uppercase tracking-[0.06em] text-mri-redh"
            >
              {m.intake_photo_delete()}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
