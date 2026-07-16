import { setLocale } from '@mr/i18n'
import * as shared from '@mr/shared'
import { compressImage } from '@mr/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { showPortalToast } from '~/lib/portal-toast'

import { ReportForm } from '../report-form'

vi.mock('@mr/shared', async () => {
  const actual = await vi.importActual<typeof import('@mr/shared')>('@mr/shared')
  return {
    ...actual,
    createClientSubmission: vi.fn(),
    uploadClientSubmissionAttachments: vi.fn(),
  }
})

vi.mock('@mr/ui', async () => {
  const actual = await vi.importActual<typeof import('@mr/ui')>('@mr/ui')
  return { ...actual, compressImage: vi.fn() }
})

vi.mock('~/lib/portal-toast', () => ({ showPortalToast: vi.fn() }))

const createSubmission = vi.mocked(shared.createClientSubmission)
const uploadAttachments = vi.mocked(shared.uploadClientSubmissionAttachments)
const compressImageMock = vi.mocked(compressImage)
const toastMock = vi.mocked(showPortalToast)

async function renderForm(): Promise<ReturnType<typeof createRouter>> {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <ReportForm />,
  })
  const claimsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/claims',
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <div data-testid="claims-page" />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, claimsRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  await router.load()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
  return router
}

function submitButton(): HTMLElement {
  return screen.getByRole('button', { name: /pošalji zahtev/i })
}

describe('ReportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLocale('sr')
  })

  it('renders the reason field and submit button', async () => {
    await renderForm()

    expect(screen.getByText('Razlog')).toBeInTheDocument()
    expect(submitButton()).toBeInTheDocument()
  })

  it('blocks an empty submission and shows a validation error', async () => {
    const user = userEvent.setup()
    await renderForm()

    // Surface the required-field error the way onChange validation does, then submit.
    const textarea = screen.getByPlaceholderText(/curi ulje/i)
    fireEvent.change(textarea, { target: { value: 'x' } })
    fireEvent.change(textarea, { target: { value: '' } })

    expect(await screen.findByText('Opišite problem')).toBeInTheDocument()

    await user.click(submitButton())
    expect(createSubmission).not.toHaveBeenCalled()
  })

  it('creates the submission, confirms with a toast, and navigates to /claims', async () => {
    const user = userEvent.setup()
    createSubmission.mockResolvedValue({ id: 'sub-1' })
    const router = await renderForm()

    await user.type(screen.getByPlaceholderText(/curi ulje/i), 'Motor se pregreva')
    await user.click(submitButton())

    await waitFor(() => {
      expect(createSubmission).toHaveBeenCalledWith({ message: 'Motor se pregreva' })
    })
    expect(toastMock).toHaveBeenCalledWith('Zahtev primljen')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/claims')
    })
  })

  it('compresses each selected image, then uploads them in one batch', async () => {
    const user = userEvent.setup()
    createSubmission.mockResolvedValue({ id: 'sub-1' })
    uploadAttachments.mockResolvedValue()
    const fileA = new File(['a'], 'a.jpg', { type: 'image/jpeg' })
    const fileB = new File(['b'], 'b.jpg', { type: 'image/jpeg' })
    const compressedA = new File(['ca'], 'a.jpg', { type: 'image/jpeg' })
    const compressedB = new File(['cb'], 'b.jpg', { type: 'image/jpeg' })
    compressImageMock.mockImplementation((file: File) =>
      Promise.resolve(file === fileA ? compressedA : compressedB),
    )
    await renderForm()

    const fileInput = document.querySelector('input[type="file"]')
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error('expected a file input in the attachment picker')
    }
    fireEvent.change(fileInput, { target: { files: [fileA, fileB] } })

    expect(await screen.findByText('a.jpg')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/curi ulje/i), 'Curi ulje')
    await user.click(submitButton())

    await waitFor(() => {
      expect(compressImageMock).toHaveBeenCalledTimes(2)
    })
    expect(compressImageMock).toHaveBeenCalledWith(fileA)
    expect(compressImageMock).toHaveBeenCalledWith(fileB)
    // Batched: ONE upload request carrying both compressed files, not one per file.
    expect(uploadAttachments).toHaveBeenCalledTimes(1)
    expect(uploadAttachments).toHaveBeenCalledWith('sub-1', [compressedA, compressedB])
  })

  it('reuses the created submission on retry after an upload failure (no duplicate)', async () => {
    const user = userEvent.setup()
    createSubmission.mockResolvedValue({ id: 'sub-1' })
    compressImageMock.mockImplementation((file: File) => Promise.resolve(file))
    // First attempt: create succeeds, upload fails. Retry: upload succeeds.
    uploadAttachments.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined)
    await renderForm()

    await user.type(screen.getByPlaceholderText(/curi ulje/i), 'Motor se pregreva')
    await user.click(submitButton())

    // The error surfaces and the button re-enables — the retry window.
    await screen.findByRole('alert')
    await waitFor(() => expect((submitButton() as HTMLButtonElement).disabled).toBe(false))

    // The impatient client clicks again.
    await user.click(submitButton())
    await waitFor(() => expect(uploadAttachments).toHaveBeenCalledTimes(2))

    // The submission was created exactly ONCE; the retry reused the same id.
    expect(createSubmission).toHaveBeenCalledTimes(1)
    expect(uploadAttachments).toHaveBeenNthCalledWith(2, 'sub-1', expect.anything())
  })
})
