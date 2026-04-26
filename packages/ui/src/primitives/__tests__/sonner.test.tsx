import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Toaster } from '../sonner.js'

describe('Toaster', () => {
  it('renders without crashing', () => {
    render(<Toaster />)
    expect(screen.getByRole('region')).toBeInTheDocument()
  })

  it('passes through props (theme)', () => {
    render(<Toaster theme="dark" />)
    expect(screen.getByRole('region')).toBeInTheDocument()
  })
})
