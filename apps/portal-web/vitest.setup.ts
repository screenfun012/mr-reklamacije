import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// @testing-library's default async window is 1000 ms, and that default assumes a machine like this
// laptop. CI is a 2-core runner with several vitest workers on it, where the same work takes several
// times longer — measured: an assertion that costs 707 ms here blew the 1000 ms window there and
// reported an empty document, which reads as a broken screen rather than a slow one. A test that is
// genuinely stuck still fails, on vitest's own testTimeout (15 s).
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
})
