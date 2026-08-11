import { describe, expect, it } from 'vitest'

import { visibleIntakeSearch } from '../intake-list-search.js'

const OFFICE = ['intake_orders.view', 'intake_orders.delete']
const FLOOR = ['intake_orders.view_own', 'intake_orders.create']

describe('visibleIntakeSearch', () => {
  it('drops a view the caller cannot see the control for', () => {
    // A serviser opening a `?view=unfinished` link an operator pasted into the shop chat: the own
    // scope ignores the view, so keeping it would only split his cache off everyone else's.
    expect(visibleIntakeSearch({ view: 'unfinished', page: 2 }, FLOOR)).toEqual({ page: 2 })
    expect(visibleIntakeSearch({ view: 'unfinished' }, FLOOR)).toEqual({})
  })

  it('leaves the office alone', () => {
    const search = { view: 'unfinished', q: 'RN-0950' } as const
    expect(visibleIntakeSearch(search, OFFICE)).toBe(search)
  })

  it('keeps every other filter when it drops the view', () => {
    expect(
      visibleIntakeSearch({ view: 'unfinished', q: 'astra', status: 'u_radu', page: 3 }, FLOOR),
    ).toEqual({ q: 'astra', status: 'u_radu', page: 3 })
  })

  it('returns the same object when there is no view to drop, so the query key does not churn', () => {
    const search = { q: 'astra' } as const
    expect(visibleIntakeSearch(search, FLOOR)).toBe(search)
  })
})
