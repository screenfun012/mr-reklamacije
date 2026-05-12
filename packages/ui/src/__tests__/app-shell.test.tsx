import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppShell } from '../layouts/app-shell.js'

describe('AppShell', () => {
  it('renders sidebar, topbar, and children content', () => {
    render(
      <AppShell
        sidebar={<div data-testid="sidebar">SIDEBAR</div>}
        topbar={<div data-testid="topbar">TOPBAR</div>}
      >
        <div data-testid="main">MAIN</div>
      </AppShell>,
    )

    expect(screen.getByTestId('sidebar')).toHaveTextContent('SIDEBAR')
    expect(screen.getByTestId('topbar')).toHaveTextContent('TOPBAR')
    expect(screen.getByTestId('main')).toHaveTextContent('MAIN')
  })

  it('uses semantic landmarks (aside, header, main)', () => {
    render(
      <AppShell sidebar={<>side</>} topbar={<>top</>}>
        <>content</>
      </AppShell>,
    )

    // <aside aria-label="Sidebar navigation"> surfaces as the
    // `complementary` landmark; <header> becomes `banner`; <main>
    // is `main`. Asserting by role keeps the test focused on
    // accessibility semantics rather than DOM structure.
    expect(screen.getByRole('complementary', { name: /sidebar navigation/i })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('accepts and applies className passthrough', () => {
    const { container } = render(
      <AppShell sidebar={<>s</>} topbar={<>t</>} className="custom-class">
        <>c</>
      </AppShell>,
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
