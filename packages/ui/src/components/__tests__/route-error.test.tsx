import { m } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RouteError } from '../route-error.js'

describe('RouteError', () => {
  it('announces itself to assistive technology', () => {
    render(<RouteError onRetry={vi.fn()} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: m.route_error_title() })).toBeVisible()
  })

  // The retry is the only part of this box that can be wrong: it shipped for a year wired to the
  // router's `reset`, which never re-runs a failed loader. The prop is what lets the app hand in
  // `router.invalidate()`, so the click has to reach it.
  it('hands the retry to its caller', async () => {
    const onRetry = vi.fn()
    render(<RouteError onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: m.route_error_retry() }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
