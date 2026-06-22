import { setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ClaimDetailTabPlaceholder } from '../claim-detail-tab-placeholder.js'

describe('ClaimDetailTabPlaceholder', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('renders default coming soon message', () => {
    render(<ClaimDetailTabPlaceholder />)

    expect(screen.getByTestId('claim-detail-tab-placeholder')).toBeInTheDocument()
    expect(screen.getByText('Uskoro')).toBeInTheDocument()
  })

  it('renders custom message when provided', () => {
    render(<ClaimDetailTabPlaceholder message="Custom placeholder" />)

    expect(screen.getByText('Custom placeholder')).toBeInTheDocument()
  })
})
