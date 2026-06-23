import type { AttachmentUploadResult, ClaimKind, AttachmentVisibility } from '@mr/shared'

export interface UploadAttachmentsInput {
  claimKind: ClaimKind
  claimId: string
  visibility: AttachmentVisibility
  files: readonly File[]
  onProgress?: (loaded: number, total: number) => void
  signal?: AbortSignal
}

export function uploadClaimAttachments(
  input: UploadAttachmentsInput,
): Promise<AttachmentUploadResult> {
  const formData = new FormData()
  formData.set('claimKind', input.claimKind)
  formData.set('claimId', input.claimId)
  formData.set('visibility', input.visibility)

  for (const file of input.files) {
    formData.append('files', file)
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/attachments/upload')
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
        input.onProgress(event.loaded, event.total)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as AttachmentUploadResult)
        return
      }

      const body = xhr.response as { message?: string; code?: string } | null
      reject(new Error(body?.message ?? 'Upload failed'))
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'))
    })

    xhr.addEventListener('abort', () => {
      reject(new DOMException('Upload aborted', 'AbortError'))
    })

    xhr.send(formData)
  })
}
