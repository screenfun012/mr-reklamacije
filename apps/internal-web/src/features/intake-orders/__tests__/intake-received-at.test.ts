import { setLocale } from '@mr/i18n'
import { beforeEach, describe, expect, it } from 'vitest'

import { formatIntakeReceivedAt } from '../intake-status.js'

describe('the list format', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  /**
   * `en` alone is US English: `Intl` renders 07/25/2026, month first, and a serviser reading a work
   * order cannot tell that from 07.25 in a hurry. The long form is tested beside the document that
   * prints it, in `@mr/intake-document`; this is the short one, which stayed here with the list.
   */
  it('keeps the list day-first too, so the list and the detail cannot disagree', () => {
    expect(formatIntakeReceivedAt('2026-07-25T07:14:00.000Z', 'en')).toMatch(/^25\/07 · 09:14$/)
  })
})
