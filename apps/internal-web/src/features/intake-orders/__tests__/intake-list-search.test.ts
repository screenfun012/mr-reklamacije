import { describe, expect, it } from 'vitest'

import { visibleIntakeSearch } from '../intake-list-search.js'

const OFFICE = ['intake_orders.view', 'intake_orders.delete']
const FLOOR = ['intake_orders.view_own', 'intake_orders.create']

describe('visibleIntakeSearch', () => {
  it('drops a view the caller may not ask for, instead of letting the server refuse it', () => {
    // A serviser opening a `?view=deleted` link an operator pasted into the shop chat: the
    // server answers 403, the route falls to its error screen, and he loses the whole list.
    expect(visibleIntakeSearch({ view: 'deleted', page: 2 }, FLOOR)).toEqual({ page: 2 })
    expect(visibleIntakeSearch({ view: 'unfinished' }, FLOOR)).toEqual({})
  })

  it('leaves the office alone', () => {
    const search = { view: 'deleted', q: 'RN-0950' } as const
    expect(visibleIntakeSearch(search, OFFICE)).toBe(search)
  })

  it('keeps every other filter when it drops the view', () => {
    expect(
      visibleIntakeSearch({ view: 'deleted', q: 'astra', status: 'u_radu', page: 3 }, FLOOR),
    ).toEqual({ q: 'astra', status: 'u_radu', page: 3 })
  })

  it('returns the same object when there is no view to drop, so the query key does not churn', () => {
    const search = { q: 'astra' } as const
    expect(visibleIntakeSearch(search, FLOOR)).toBe(search)
  })
})
