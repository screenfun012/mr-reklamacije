import { intakeOrderKeys } from '@mr/shared'
import { compressImage } from '@mr/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { IntakePhotoUploadError, uploadIntakePhoto } from '../upload-intake-photo'

/**
 * The prose handoff asks for ~1920px; the shared helper defaults to 2048. The server stores at
 * 2048 either way, so the smaller edge buys nothing but upload bandwidth — which is exactly the
 * point on the hall's WiFi.
 */
const COMPRESS_MAX_EDGE = 1920

export type IntakePhotoUploadState = 'up' | 'ok' | 'wait' | 'err'

export interface IntakePhotoQueueEntry {
  /** Local id — the server's attachment id only exists once the upload lands. */
  id: string
  damageId: string | null
  state: IntakePhotoUploadState
  progress: number
  /** Object URL, so a cell shows the photo before the server has ever seen it. */
  previewUrl: string
  attachmentId: string | null
}

export interface IntakePhotoQueue {
  entries: IntakePhotoQueueEntry[]
  /** Still on their way or waiting for a network — what `photosExpected` must count. */
  pending: number
  failed: number
  enqueue: (files: readonly File[], damageId: string | null) => void
  retry: (entryId: string) => void
  discard: (entryId: string) => void
}

interface QueueItem extends IntakePhotoQueueEntry {
  file: File
}

function localId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * The upload queue, deliberately owned by the WIZARD and not by step 3. Two reasons, both from
 * docs/25: the stepper chip on steps 4–5 reports what is still in flight, and a photo taken just
 * before the signature must keep uploading after the serviser has moved on — the server treats a
 * late arrival from the order's own technician as part of the intake rather than an amendment.
 * Unmounting the queue with the step would quietly turn that rule into dead code.
 */
export function useIntakePhotoQueue(orderId: string | null): IntakePhotoQueue {
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<QueueItem[]>([])
  /** Reading state inside the send loop would capture a stale array between two uploads. */
  const entriesRef = useRef<QueueItem[]>([])
  entriesRef.current = entries

  const patch = useCallback((id: string, next: Partial<QueueItem>) => {
    setEntries((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)))
  }, [])

  /**
   * Takes the photo itself rather than an id to look up. `entriesRef` only catches up on the next
   * render, so a freshly enqueued entry is not in it yet — looking it up here meant the first
   * upload of every photo silently never started and the cell sat at 5% forever.
   */
  const send = useCallback(
    ({ id, file, damageId }: { id: string; file: File; damageId: string | null }) => {
      if (orderId === null) {
        return
      }

      patch(id, { state: 'up', progress: 5 })

      void uploadIntakePhoto({
        orderId,
        file,
        damageId,
        onProgress: (percent) => {
          patch(id, { progress: percent })
        },
      })
        .then((photo) => {
          patch(id, { state: 'ok', progress: 100, attachmentId: photo.id })
          void queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
        })
        .catch((error: unknown) => {
          // A request that never reached the server waits and goes again by itself; one the
          // server refused needs a person, so it stops and says so.
          const reason =
            error instanceof IntakePhotoUploadError && error.reason === 'network' ? 'wait' : 'err'
          patch(id, { state: reason })
        })
    },
    [orderId, patch, queryClient],
  )

  const enqueue = useCallback(
    (files: readonly File[], damageId: string | null) => {
      for (const file of files) {
        const id = localId()
        void (async () => {
          // `compressImage` hands back the original whenever it cannot decode the file — HEIC off
          // an iPad is the real case — so the upload path must survive a full-size photo.
          const compressed = await compressImage(file, { maxEdge: COMPRESS_MAX_EDGE })
          setEntries((prev) => [
            ...prev,
            {
              id,
              file: compressed,
              damageId,
              state: 'up',
              progress: 5,
              previewUrl: URL.createObjectURL(compressed),
              attachmentId: null,
            },
          ])
          send({ id, file: compressed, damageId })
        })()
      }
    },
    [send],
  )

  const retry = useCallback(
    (entryId: string) => {
      const item = entriesRef.current.find((entry) => entry.id === entryId)
      if (item !== undefined) {
        send({ id: item.id, file: item.file, damageId: item.damageId })
      }
    },
    [send],
  )

  const discard = useCallback((entryId: string) => {
    setEntries((prev) => {
      const going = prev.find((entry) => entry.id === entryId)
      if (going !== undefined) {
        URL.revokeObjectURL(going.previewUrl)
      }
      return prev.filter((entry) => entry.id !== entryId)
    })
  }, [])

  // Coming back online is the one moment a waiting photo can move on its own. `navigator.onLine`
  // is not trusted as a source of truth — only as this nudge; the authority is whether the
  // request itself got through.
  useEffect(() => {
    const resume = (): void => {
      for (const entry of entriesRef.current) {
        if (entry.state === 'wait') {
          send({ id: entry.id, file: entry.file, damageId: entry.damageId })
        }
      }
    }
    window.addEventListener('online', resume)
    return () => {
      window.removeEventListener('online', resume)
    }
  }, [send])

  useEffect(() => {
    return () => {
      for (const entry of entriesRef.current) {
        URL.revokeObjectURL(entry.previewUrl)
      }
    }
  }, [])

  return {
    entries,
    pending: entries.filter((entry) => entry.state === 'up' || entry.state === 'wait').length,
    failed: entries.filter((entry) => entry.state === 'err').length,
    enqueue,
    retry,
    discard,
  }
}
