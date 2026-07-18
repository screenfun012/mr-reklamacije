import { setLocale } from '@mr/i18n'
import {
  AttachmentVisibility,
  ClaimKind,
  ClaimOutcome,
  ClientClaimPhase,
  attachmentsListOptions,
  type AttachmentListItem,
  type ClientClaimDetail,
  type SectionFreshness,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { BasicsCard, InspectionCard, ReportedProblemCard } from '../claim-detail-cards'
import { PhotosCard } from '../photos-card'
import { TimelineCard } from '../timeline-card'

const ALL_FRESH_FALSE: SectionFreshness = {
  photos: false,
  inspection: false,
  details: false,
  outcome: false,
}

function baseDetail(overrides: Partial<ClientClaimDetail> = {}): ClientClaimDetail {
  return {
    kind: ClaimKind.Emotive,
    id: 'c1111111-1111-1111-1111-111111111111',
    claimNumber: '7167/25',
    mrNumber: 'MR-7167',
    warrantyReport: 'Motor se pregreva.',
    engineTypeCode: 'X200',
    manufacturerName: 'Acme',
    engineCode: 'ENG-1',
    dateOfClaim: '2026-06-01',
    dateOfFinish: null,
    outcome: ClaimOutcome.Pending,
    claimYear: 2026,
    customerName: 'Partner d.o.o.',
    createdAt: '2026-06-01T00:00:00.000Z',
    clientPhase: ClientClaimPhase.InProgress,
    freshness: null,
    engineTypeManufacturer: null,
    inspectionReport: 'Sve u redu.',
    employeeName: 'Marko Marković',
    sectionFreshness: ALL_FRESH_FALSE,
    ...overrides,
  }
}

function fixturePhoto(claimId: string): AttachmentListItem {
  return {
    id: 'a1111111-1111-1111-1111-111111111111',
    claimKind: ClaimKind.Emotive,
    claimId,
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 1024,
    width: 400,
    height: 300,
    durationSeconds: null,
    thumbnailPath: null,
    caption: null,
    visibility: AttachmentVisibility.ClientVisible,
    uploadedBy: null,
    uploadedAt: '2026-06-01T00:00:00.000Z',
    contentSha256: 'abc123',
  }
}

function renderWithPhoto(claim: ClientClaimDetail): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(attachmentsListOptions(ClaimKind.Emotive, claim.id).queryKey, {
    items: [fixturePhoto(claim.id)],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <PhotosCard claimId={claim.id} isFresh={claim.sectionFreshness.photos} />
    </QueryClientProvider>,
  )
}

describe('claim detail section freshness markers', () => {
  beforeEach(() => setLocale('sr'))

  it('shows the Novo marker on BasicsCard and ReportedProblemCard when sectionFreshness.details is true', () => {
    const claim = baseDetail({ sectionFreshness: { ...ALL_FRESH_FALSE, details: true } })
    render(
      <>
        <BasicsCard claim={claim} />
        <ReportedProblemCard claim={claim} />
      </>,
    )

    expect(screen.getAllByText('Novo')).toHaveLength(2)
  })

  it('shows the Novo marker on InspectionCard when sectionFreshness.inspection is true', () => {
    const claim = baseDetail({ sectionFreshness: { ...ALL_FRESH_FALSE, inspection: true } })
    render(<InspectionCard claim={claim} />)

    expect(screen.getByText('Novo')).toBeInTheDocument()
  })

  it('shows the Novo marker on TimelineCard when sectionFreshness.outcome is true', () => {
    const claim = baseDetail({ sectionFreshness: { ...ALL_FRESH_FALSE, outcome: true } })
    render(<TimelineCard claim={claim} />)

    expect(screen.getByText('Novo')).toBeInTheDocument()
  })

  it('shows the Novo marker on PhotosCard when sectionFreshness.photos is true', async () => {
    const claim = baseDetail({ sectionFreshness: { ...ALL_FRESH_FALSE, photos: true } })
    renderWithPhoto(claim)

    expect(await screen.findByText('Novo')).toBeInTheDocument()
  })

  it('renders no Novo markers anywhere when sectionFreshness is all-false', async () => {
    const claim = baseDetail()
    render(
      <>
        <BasicsCard claim={claim} />
        <ReportedProblemCard claim={claim} />
        <InspectionCard claim={claim} />
        <TimelineCard claim={claim} />
      </>,
    )
    renderWithPhoto(claim)

    // PhotosCard resolves its query async — wait for the photo grid, then assert.
    await screen.findByRole('button')
    expect(screen.queryByText('Novo')).not.toBeInTheDocument()
  })
})
