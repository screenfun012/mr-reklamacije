import { ApiError, parseApiErrorBody, type IntakeOrderDetail } from '@mr/shared'

/**
 * One file, no progress bar. Unlike the photo queue this is a single small document a person picks
 * and waits two seconds for — the queue's XHR machinery exists for a tablet uploading twenty
 * pictures over the hall's WiFi, and none of that applies here.
 */
export async function uploadIntakeQuote(orderId: string, file: File): Promise<IntakeOrderDetail> {
  const formData = new FormData()
  formData.append('files', file)

  const response = await fetch(`/api/intake-orders/${orderId}/quote`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  if (response.ok) {
    return (await response.json()) as IntakeOrderDetail
  }

  // The server's own sentence when it has one — "file too large", "unsupported type" — because a
  // generic failure here tells the office nothing about a file it can simply re-export.
  let parsed: { message: string; code?: string } = {
    message: response.statusText || 'Request failed',
  }
  try {
    parsed = parseApiErrorBody(await response.json())
  } catch {
    // Non-JSON error bodies fall back to the status text.
  }

  throw new ApiError(parsed.message, response.status, parsed.code)
}
