import { attachmentsListOptions, ClaimKind, type AttachmentListItem } from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EmotiveClaimAttachmentsTab } from '../emotive-claim-attachments-tab.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'
const ATTACHMENT_ID = '22222222-2222-4222-8222-222222222222'

vi.mock('~/lib/auth-client.js', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'user-1' } } }),
  },
}))

let permissions: string[] = []

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    getRouteApi: () => ({
      useRouteContext: () => ({
        authSession: { user: { permissions } },
      }),
    }),
  }
})

function makeAttachment(): AttachmentListItem {
  return {
    id: ATTACHMENT_ID,
    claimKind: ClaimKind.Emotive,
    claimId: CLAIM_ID,
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 1024,
    width: 800,
    height: 600,
    durationSeconds: null,
    thumbnailPath: null,
    caption: null,
    visibility: 'internal',
    uploadedBy: 'someone-else',
    uploadedAt: '2026-05-01T10:00:00.000Z',
    contentSha256: 'abc',
  } as unknown as AttachmentListItem
}

function renderTab(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(attachmentsListOptions(ClaimKind.Emotive, CLAIM_ID).queryKey, {
    items: [makeAttachment()],
  })

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <EmotiveClaimAttachmentsTab claimId={CLAIM_ID} />
    </QueryClientProvider>
  )
  render(node)
}

describe('EmotiveClaimAttachmentsTab', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('allows upload and delete regardless of the claim outcome (backend no longer locks editing)', () => {
    permissions = ['attachments.upload', 'attachments.delete_any']
    renderTab()

    expect(screen.getByTestId('claim-attachments-dropzone')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: m.claim_attachments_grid_delete() }),
    ).toBeInTheDocument()
    // The "claim is locked" hint paragraph no longer exists in the component at all
    // (removed with the i18n key claim_attachments_locked_hint) — the dropzone
    // rendering above is the proof the locked branch is gone.
  })

  it('still hides upload/delete affordances when the user lacks the permission', () => {
    permissions = []
    renderTab()

    expect(screen.queryByTestId('claim-attachments-dropzone')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: m.claim_attachments_grid_delete() }),
    ).not.toBeInTheDocument()
  })
})
