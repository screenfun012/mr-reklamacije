import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InternalPage } from '../internal-page.js'

/*
 * The whole point of this component is that the number lives in one place. A screen that
 * writes its own `max-w` is the bug it exists to prevent, and nothing about that is visible
 * to a behavioural test — so the contract is pinned here instead.
 */
describe('InternalPage', () => {
  it('caps a wide page at the desktop width', () => {
    render(
      <InternalPage>
        <p>lista</p>
      </InternalPage>,
    )
    expect(screen.getByText('lista').parentElement?.className).toContain('max-w-[1280px]')
  })

  it('caps a form at the narrower width the wizard was agreed at', () => {
    render(
      <InternalPage width="narrow">
        <p>čarobnjak</p>
      </InternalPage>,
    )
    expect(screen.getByText('čarobnjak').parentElement?.className).toContain('max-w-[980px]')
  })

  it('centres either width, so a capped page does not sit against the left edge', () => {
    render(
      <InternalPage width="narrow">
        <p>centriran</p>
      </InternalPage>,
    )
    expect(screen.getByText('centriran').parentElement?.className).toContain('mx-auto')
  })
})
