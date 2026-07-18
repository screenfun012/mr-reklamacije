import {
  ClaimKind,
  ClaimReportStatus,
  claimReportOptions,
  type ClaimReportResponse,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DomaceClaimReportTab } from '../domace-claim-report-tab.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

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

function makeReport(): ClaimReportResponse {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    claimKind: ClaimKind.Domace,
    claimId: CLAIM_ID,
    contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
    contentHtml: '<p>Some report text</p>',
    status: ClaimReportStatus.Draft,
    persisted: true,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    createdBy: null,
    updatedBy: null,
  }
}

function renderTab(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(claimReportOptions(ClaimKind.Domace, CLAIM_ID).queryKey, makeReport())

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <DomaceClaimReportTab claimId={CLAIM_ID} />
    </QueryClientProvider>
  )
  render(node)
}

describe('DomaceClaimReportTab', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is editable regardless of the claim outcome (backend no longer locks editing)', () => {
    permissions = ['claim_reports.view', 'claim_reports.update']
    renderTab()

    expect(screen.getByRole('button', { name: m.claim_report_edit() })).toBeInTheDocument()
    // The "claim is locked" hint paragraph no longer exists in the component at all
    // (removed with the i18n key claim_report_locked_hint) — the Edit button
    // rendering above is the proof the locked branch is gone.
  })

  it('still hides the edit button when the user lacks the update permission', () => {
    permissions = ['claim_reports.view']
    renderTab()

    expect(screen.queryByRole('button', { name: m.claim_report_edit() })).not.toBeInTheDocument()
  })
})
