import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Skeleton } from '../skeleton.js'

describe('Skeleton', () => {
  it('renders a div with default classes', () => {
    render(<Skeleton data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton.className).toContain('animate-pulse')
    expect(skeleton.className).toContain('bg-primary/10')
  })

  it('applies custom className', () => {
    render(<Skeleton className="h-10 w-20" data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton.className).toContain('h-10')
    expect(skeleton.className).toContain('w-20')
  })

  it('passes through HTML attributes', () => {
    render(<Skeleton role="status" aria-label="Loading" data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveAttribute('role', 'status')
    expect(skeleton).toHaveAttribute('aria-label', 'Loading')
  })
})
