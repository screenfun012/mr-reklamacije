import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Heading } from '../heading.js'

describe('Heading', () => {
  it('renders h1 level with text-h1 class', () => {
    render(<Heading level="h1">Page title</Heading>)
    const heading = screen.getByRole('heading', { level: 1, name: 'Page title' })
    expect(heading.className).toContain('text-h1')
  })

  it('renders h3 level with text-h3 class', () => {
    render(<Heading level="h3">Section</Heading>)
    const heading = screen.getByRole('heading', { level: 3, name: 'Section' })
    expect(heading.className).toContain('text-h3')
  })

  it('uses as prop for semantic element override', () => {
    render(
      <Heading level="h3" as="h2">
        Section as h2
      </Heading>,
    )
    const heading = screen.getByRole('heading', { level: 2, name: 'Section as h2' })
    expect(heading.className).toContain('text-h3')
  })

  it('renders display level as h1 with text-display class', () => {
    render(<Heading level="display">Hero</Heading>)
    const heading = screen.getByRole('heading', { level: 1, name: 'Hero' })
    expect(heading.className).toContain('text-display')
  })

  it('merges custom className', () => {
    render(
      <Heading level="h2" className="mt-4">
        Subtitle
      </Heading>,
    )
    const heading = screen.getByRole('heading', { level: 2, name: 'Subtitle' })
    expect(heading.className).toContain('text-h2')
    expect(heading.className).toContain('mt-4')
  })
})
