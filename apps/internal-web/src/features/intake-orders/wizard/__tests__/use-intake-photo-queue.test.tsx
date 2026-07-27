import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IntakePhotoUploadError } from '../../upload-intake-photo.js'
import { useIntakePhotoQueue } from '../use-intake-photo-queue.js'

const uploadIntakePhoto = vi.hoisted(() => vi.fn())

vi.mock('../../upload-intake-photo.js', async () => {
  const actual = await vi.importActual<typeof import('../../upload-intake-photo.js')>(
    '../../upload-intake-photo.js',
  )
  return { ...actual, uploadIntakePhoto }
})

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function photo(): File {
  return new File([new Uint8Array([1, 2, 3])], 'IMG_01.jpg', { type: 'image/jpeg' })
}

describe('useIntakePhotoQueue', () => {
  beforeEach(() => {
    uploadIntakePhoto.mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * The first version looked the entry up in a ref that only catches up on the next render, so a
   * freshly enqueued photo was never found and the upload silently never started — the cell simply
   * sat at 5% forever, with nothing in the console and nothing on the server.
   */
  it('actually starts the upload of a photo it has only just been handed', async () => {
    uploadIntakePhoto.mockResolvedValue({ id: 'att-1' })
    const { result } = renderHook(() => useIntakePhotoQueue('order-1'), { wrapper })

    act(() => {
      result.current.enqueue([photo()], 'd1')
    })

    await waitFor(() => {
      expect(uploadIntakePhoto).toHaveBeenCalledTimes(1)
    })
    expect(uploadIntakePhoto.mock.calls[0]?.[0]).toMatchObject({
      orderId: 'order-1',
      damageId: 'd1',
    })
    await waitFor(() => {
      expect(result.current.entries[0]?.state).toBe('ok')
    })
    expect(result.current.entries[0]?.attachmentId).toBe('att-1')
    expect(result.current.pending).toBe(0)
  })

  it('waits — not fails — when the request never reached the server', async () => {
    uploadIntakePhoto.mockRejectedValue(new IntakePhotoUploadError('network', 'no route'))
    const { result } = renderHook(() => useIntakePhotoQueue('order-1'), { wrapper })

    act(() => {
      result.current.enqueue([photo()], null)
    })

    await waitFor(() => {
      expect(result.current.entries[0]?.state).toBe('wait')
    })
    // A waiting photo still counts as expected, or the "not every photo arrived" indicator is a lie.
    expect(result.current.pending).toBe(1)
    expect(result.current.failed).toBe(0)
  })

  it('stops and asks for a person when the server refused the photo', async () => {
    uploadIntakePhoto.mockRejectedValue(new IntakePhotoUploadError('rejected', 'not an image'))
    const { result } = renderHook(() => useIntakePhotoQueue('order-1'), { wrapper })

    act(() => {
      result.current.enqueue([photo()], null)
    })

    await waitFor(() => {
      expect(result.current.entries[0]?.state).toBe('err')
    })
    expect(result.current.failed).toBe(1)
    expect(result.current.pending).toBe(0)
  })

  it('re-sends the same photo on retry rather than losing its bytes', async () => {
    uploadIntakePhoto.mockRejectedValueOnce(new IntakePhotoUploadError('rejected', 'nope'))
    const { result } = renderHook(() => useIntakePhotoQueue('order-1'), { wrapper })

    act(() => {
      result.current.enqueue([photo()], 'd2')
    })
    await waitFor(() => {
      expect(result.current.entries[0]?.state).toBe('err')
    })

    uploadIntakePhoto.mockResolvedValueOnce({ id: 'att-2' })
    const entryId = result.current.entries[0]?.id ?? ''
    act(() => {
      result.current.retry(entryId)
    })

    await waitFor(() => {
      expect(result.current.entries[0]?.state).toBe('ok')
    })
    expect(uploadIntakePhoto).toHaveBeenCalledTimes(2)
    expect(uploadIntakePhoto.mock.calls[1]?.[0]).toMatchObject({ damageId: 'd2' })
  })

  it('sends nothing while the intake has no row on the server yet', () => {
    const { result } = renderHook(() => useIntakePhotoQueue(null), { wrapper })

    act(() => {
      result.current.enqueue([photo()], null)
    })

    expect(uploadIntakePhoto).not.toHaveBeenCalled()
  })
})
