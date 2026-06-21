import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from '../button.js'

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies brand primary hover and active tokens on default variant', () => {
    render(<Button>Primary</Button>)
    const button = screen.getByRole('button', { name: 'Primary' })
    expect(button.className).toContain('bg-primary')
    expect(button.className).toContain('hover:bg-[var(--mr-primary-hover)]')
    expect(button.className).toContain('active:bg-[var(--mr-primary-active)]')
  })

  it('applies brand secondary border on outline variant', () => {
    render(<Button variant="outline">Secondary</Button>)
    const button = screen.getByRole('button', { name: 'Secondary' })
    expect(button.className).toContain('border-[1.5px]')
    expect(button.className).toContain('border-primary')
    expect(button.className).toContain('hover:bg-[var(--mr-red-50-wash)]')
  })

  it('applies destructive variant with solid error fill', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button.className).toContain('bg-destructive')
    expect(button.className).not.toContain('opacity-50')
  })

  it('uses neutral disabled styling instead of opacity', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: 'Disabled' })
    expect(button.className).toContain('disabled:bg-[var(--mr-disabled-bg)]')
    expect(button.className).toContain('disabled:text-[var(--mr-disabled-text)]')
    expect(button.className).not.toContain('disabled:opacity-50')
  })

  it('applies focus ring with offset for keyboard users', () => {
    render(<Button>Focus</Button>)
    const button = screen.getByRole('button', { name: 'Focus' })
    expect(button.className).toContain('focus-visible:ring-2')
    expect(button.className).toContain('focus-visible:ring-offset-2')
  })

  it('uses brand medium height (40px) by default', () => {
    render(<Button>Medium</Button>)
    const button = screen.getByRole('button', { name: 'Medium' })
    expect(button.className).toContain('h-10')
    expect(button.className).toContain('text-base')
  })

  it('uses 44px touch target for icon size', () => {
    render(
      <Button size="icon" aria-label="Next">
        →
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Next' })
    expect(button.className).toContain('size-11')
  })

  it('shows spinner when loading and keeps label for width', () => {
    render(<Button loading>Submit</Button>)
    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    expect(button.querySelector('.animate-spin')).toBeInTheDocument()
    expect(button.textContent).toContain('Submit')
  })

  it('renders as anchor when asChild and child is anchor', () => {
    render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Link' })
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
  })

  it('forwards ref to button element', () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(<Button ref={ref}>Ref test</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('applies custom className alongside variant classes', () => {
    render(<Button className="custom-class">Test</Button>)
    const button = screen.getByRole('button', { name: 'Test' })
    expect(button.className).toContain('custom-class')
  })
})
