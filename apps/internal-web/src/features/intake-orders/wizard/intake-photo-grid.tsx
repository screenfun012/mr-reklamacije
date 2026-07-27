import { m } from '@mr/i18n'
import { buildIntakePhotoUrl, type IntakeDamage, type IntakeOrderPhoto } from '@mr/shared'
import { cn } from '@mr/ui'
import { Camera, Images, Plus } from 'lucide-react'
import { useRef, type ReactElement } from 'react'

import { intakeDamageMarkerColour } from './intake-damage-map'
import { IntakePanel } from './intake-panel'
import type { IntakePhotoQueueEntry } from './use-intake-photo-queue'

/** One cell of the grid, from either source: already on the server, or still on its way. */
export interface IntakePhotoCell {
  key: string
  url: string
  /** 1-based marker number, or null for a general shot of the vehicle. */
  number: number | null
  numberColour: { fill: string; text: string } | null
  state: IntakePhotoQueueEntry['state']
  progress: number
  /** Present only while the cell is a queue entry — a failed upload retries through it. */
  entryId: string | null
  attachmentId: string | null
}

const STATE_BORDER: Record<IntakePhotoQueueEntry['state'], string> = {
  ok: 'border-mri-border2',
  up: 'border-mri-border2',
  wait: 'border-[rgba(245,165,36,0.6)]',
  err: 'border-mri-red',
}

const STATE_VEIL: Record<IntakePhotoQueueEntry['state'], string> = {
  ok: '',
  up: 'bg-[rgba(11,11,13,0.5)]',
  wait: 'bg-[rgba(11,11,13,0.45)]',
  err: 'bg-[rgba(237,28,36,0.32)]',
}

const STATE_TEXT: Record<IntakePhotoQueueEntry['state'], string> = {
  ok: '',
  up: 'text-mri-text',
  wait: 'text-mri-amb',
  err: 'text-white',
}

/**
 * Builds the grid out of both sources at once. A photo the server already has wins over the queue
 * entry that produced it, so a cell never appears twice in the moment between the upload landing
 * and the detail query refetching.
 */
export function buildPhotoCells(
  orderId: string | null,
  serverPhotos: readonly IntakeOrderPhoto[],
  queue: readonly IntakePhotoQueueEntry[],
  damages: readonly IntakeDamage[],
): IntakePhotoCell[] {
  const numberOf = (damageId: string | null): { n: number | null; damage: IntakeDamage | null } => {
    if (damageId === null) {
      return { n: null, damage: null }
    }
    const index = damages.findIndex((damage) => damage.id === damageId)
    // A photo whose damage was removed keeps its bytes and loses its number, by design.
    return index < 0 ? { n: null, damage: null } : { n: index + 1, damage: damages[index] ?? null }
  }

  const landed = new Set(serverPhotos.map((photo) => photo.id))

  const fromServer: IntakePhotoCell[] = serverPhotos.map((photo) => {
    const { n, damage } = numberOf(photo.damageId)
    return {
      key: `s:${photo.id}`,
      url: orderId === null ? '' : buildIntakePhotoUrl(orderId, photo.id, 'thumbnail'),
      number: n,
      numberColour: damage === null ? null : intakeDamageMarkerColour(damage.type),
      state: 'ok',
      progress: 100,
      entryId: null,
      attachmentId: photo.id,
    }
  })

  const inFlight: IntakePhotoCell[] = queue
    .filter((entry) => entry.attachmentId === null || !landed.has(entry.attachmentId))
    .map((entry) => {
      const { n, damage } = numberOf(entry.damageId)
      return {
        key: `q:${entry.id}`,
        url: entry.previewUrl,
        number: n,
        numberColour: damage === null ? null : intakeDamageMarkerColour(damage.type),
        state: entry.state,
        progress: entry.progress,
        entryId: entry.id,
        attachmentId: entry.attachmentId,
      }
    })

  return [...fromServer, ...inFlight]
}

export interface IntakePhotoGridProps {
  cells: readonly IntakePhotoCell[]
  onPick: (files: readonly File[]) => void
  onOpen: (cell: IntakePhotoCell) => void
  onRetry: (entryId: string) => void
}

export function IntakePhotoGrid({
  cells,
  onPick,
  onOpen,
  onRetry,
}: IntakePhotoGridProps): ReactElement {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const pick = (input: HTMLInputElement | null): void => {
    const files = input?.files
    if (files !== null && files !== undefined && files.length > 0) {
      onPick([...files])
    }
    if (input !== null) {
      // Cleared, or picking the same file twice in a row fires no change event.
      input.value = ''
    }
  }

  return (
    <IntakePanel
      title={m.intake_card_photos()}
      action={
        <span className="font-mono text-[11px] uppercase text-mri-text2">
          {m.intake_photos_taken({ count: cells.length })}
        </span>
      }
      className="min-h-0 flex-1 gap-[11px] px-[18px] py-4"
    >
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid grid-cols-4 gap-2.5">
          {cells.map((cell) => (
            <button
              key={cell.key}
              type="button"
              onClick={() => {
                if (cell.state === 'err' && cell.entryId !== null) {
                  onRetry(cell.entryId)
                  return
                }
                onOpen(cell)
              }}
              aria-label={
                cell.state === 'err' ? m.intake_photo_state_failed() : m.intake_photo_preview()
              }
              className={cn(
                'relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-[9px] border bg-mri-inbg',
                STATE_BORDER[cell.state],
              )}
            >
              <img src={cell.url} alt="" className="size-full object-cover" />

              {cell.number !== null && cell.numberColour !== null ? (
                <span
                  className="absolute left-[5px] top-[5px] grid size-5 place-items-center rounded-full font-mono text-[10.5px] font-bold"
                  style={{ background: cell.numberColour.fill, color: cell.numberColour.text }}
                >
                  {cell.number}
                </span>
              ) : null}

              {cell.state !== 'ok' ? (
                <span
                  className={cn(
                    'absolute inset-0 grid place-items-center px-1 text-center font-mono text-[10px] font-bold uppercase leading-[1.4] tracking-[0.08em]',
                    STATE_VEIL[cell.state],
                    STATE_TEXT[cell.state],
                  )}
                >
                  {cell.state === 'err'
                    ? `! ${m.intake_photo_state_failed()}`
                    : cell.state === 'wait'
                      ? `⌁ ${m.intake_photo_state_waiting()}`
                      : `${cell.progress}%`}
                </span>
              ) : null}

              {cell.state === 'up' ? (
                <span
                  className="absolute bottom-0 left-0 h-[3px] bg-mri-info transition-[width] duration-200"
                  style={{ width: `${cell.progress}%` }}
                />
              ) : null}
            </button>
          ))}

          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            aria-label={m.intake_photo_open_camera()}
            className="grid aspect-[4/3] cursor-pointer place-items-center rounded-[9px] border border-dashed border-mri-border2 text-mri-text2 transition-colors duration-200 hover:border-mri-red hover:text-mri-redh motion-reduce:transition-none"
          >
            <Plus className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-none gap-2.5">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[11px] border border-mri-red bg-[rgba(237,28,36,0.13)] text-sm font-extrabold uppercase tracking-[0.06em] text-mri-redh"
        >
          <Camera className="size-4" aria-hidden="true" />
          {m.intake_photo_open_camera()}
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex h-[52px] w-[132px] cursor-pointer items-center justify-center gap-2 rounded-[11px] border border-mri-border2 bg-mri-inbg text-[13px] font-semibold text-mri-text2"
        >
          <Images className="size-4" aria-hidden="true" />
          {m.intake_photo_from_gallery()}
        </button>
      </div>

      {/*
        A native file input, never `getUserMedia`: that demands a secure context, and the tablet
        reaches the dev server over plain http on the hall LAN (docs/25 §3.8). `capture` is what
        opens the camera directly — the gallery input is the same element WITHOUT it, which is the
        whole difference between the two buttons.
      */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={() => pick(cameraRef.current)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={() => pick(galleryRef.current)}
      />
    </IntakePanel>
  )
}
