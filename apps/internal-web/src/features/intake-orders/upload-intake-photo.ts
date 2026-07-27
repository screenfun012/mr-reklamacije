import type { IntakeOrderPhoto } from '@mr/shared'

/**
 * Why the upload failed, which is the whole difference between the two states a serviser sees:
 * `network` means the request never reached the server, so the photo waits and goes again by
 * itself; `rejected` means the server answered no, so it needs a tap. Guessing from
 * `navigator.onLine` is not enough — the hall's WiFi answers DHCP and routes nowhere, and the
 * browser calls that online.
 */
export type IntakePhotoUploadFailure = 'network' | 'rejected'

export class IntakePhotoUploadError extends Error {
  readonly reason: IntakePhotoUploadFailure

  constructor(reason: IntakePhotoUploadFailure, message: string) {
    super(message)
    this.name = 'IntakePhotoUploadError'
    this.reason = reason
  }
}

export interface UploadIntakePhotoInput {
  orderId: string
  file: File
  /** The damage this photo documents, or null for a general shot of the vehicle. */
  damageId: string | null
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * One photo per request, because that is what the endpoint accepts — and it is also what the grid
 * wants: each cell reports its own progress and fails on its own. XHR rather than `fetch`, which
 * still cannot report upload progress; the same reason `uploadClaimAttachments` uses it.
 */
export function uploadIntakePhoto(input: UploadIntakePhotoInput): Promise<IntakeOrderPhoto> {
  const formData = new FormData()
  formData.append('files', input.file)
  // An empty string fails the server's `min(1)`; a general photo must send no field at all.
  if (input.damageId !== null) {
    formData.set('damageId', input.damageId)
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/intake-orders/${input.orderId}/photos`)
    xhr.withCredentials = true
    xhr.responseType = 'json'

    if (input.signal !== undefined) {
      if (input.signal.aborted) {
        reject(new DOMException('Upload aborted', 'AbortError'))
        return
      }
      input.signal.addEventListener('abort', () => {
        xhr.abort()
      })
    }

    xhr.upload.addEventListener('progress', (event: ProgressEvent<EventTarget>) => {
      if (event.lengthComputable && input.onProgress !== undefined) {
        input.onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as IntakeOrderPhoto)
        return
      }

      const body = xhr.response as { error?: { message?: string } } | null
      reject(new IntakePhotoUploadError('rejected', body?.error?.message ?? 'Upload failed'))
    })

    xhr.addEventListener('error', () => {
      reject(new IntakePhotoUploadError('network', 'Upload could not reach the server'))
    })

    xhr.addEventListener('abort', () => {
      reject(new DOMException('Upload aborted', 'AbortError'))
    })

    xhr.send(formData)
  })
}
