import { setLocale } from '@mr/i18n'
import * as shared from '@mr/shared'
import { compressImage } from '@mr/ui'
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
    uploadClientSubmissionAttachment: vi.fn(),
  }
})

vi.mock('@mr/ui', async () => {
  const actual = await vi.importActual<typeof import('@mr/ui')>('@mr/ui')
  return { ...actual, compressImage: vi.fn() }
})

vi.mock('~/lib/portal-toast', () => ({ showPortalToast: vi.fn() }))

const createSubmission = vi.mocked(shared.createClientSubmission)
const uploadAttachment = vi.mocked(shared.uploadClientSubmissionAttachment)
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
  await router.load()
  render(<RouterProvider router={router as never} />)
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

  it('compresses each selected image, then uploads the compressed file', async () => {
    const user = userEvent.setup()
    createSubmission.mockResolvedValue({ id: 'sub-1' })
    uploadAttachment.mockResolvedValue()
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' })
    compressImageMock.mockResolvedValue(compressed)
    await renderForm()

    const fileInput = document.querySelector('input[type="file"]')
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error('expected a file input in the attachment picker')
    }
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText('photo.jpg')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/curi ulje/i), 'Curi ulje')
    await user.click(submitButton())

    await waitFor(() => {
      expect(compressImageMock).toHaveBeenCalledWith(file)
      expect(uploadAttachment).toHaveBeenCalledWith('sub-1', compressed)
    })
  })
})
