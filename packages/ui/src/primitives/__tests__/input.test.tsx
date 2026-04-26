import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Input } from '../input.js'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Type here" />)
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
  })

  it('applies custom type', () => {
    render(<Input type="email" data-testid="email-input" />)
    const input = screen.getByTestId('email-input')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('applies custom className alongside default styles', () => {
    render(<Input className="custom-class" data-testid="styled-input" />)
    const input = screen.getByTestId('styled-input')
    expect(input.className).toContain('custom-class')
    expect(input.className).toContain('rounded-md')
  })

  it('forwards ref', () => {
    const ref = { current: null as HTMLInputElement | null }
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})
