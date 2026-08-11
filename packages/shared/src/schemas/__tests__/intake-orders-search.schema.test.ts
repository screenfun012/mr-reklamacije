import { describe, expect, it } from 'vitest'

import { INTAKE_SEARCH_MAX_LENGTH, IntakeOrdersSearchSchema } from '../intake-order.wire.schema.js'

/*
 * `/prijem` is reached by bookmark, by a link pasted into the shop chat, and by a hand-edited
 * address bar, and the route bare-`parse`s this schema in `validateSearch` — so ONE bad param must
 * not throw there. It did: `?view=deleted` threw the day the removed view was retired, and a search
 * term over the cap threw while it was still reachable by typing. Either put the office on the
 * list's error component with no table, no filter bar and no way to clear the param from the page.
 *
 * The fallback is always "field absent", which every consumer already reads as its default —
 * `intakeFiltersFromSearch` omits an absent filter and resolves `page ?? 1` /
 * `pageSize ?? INTAKE_ORDERS_PAGE_SIZE`.
 */
describe('IntakeOrdersSearchSchema tolerates a bad URL', () => {
  it('drops a view it no longer knows', () => {
    expect(IntakeOrdersSearchSchema.parse({ view: 'deleted' })).toEqual({})
  })

  it('drops an unknown status rather than breaking the page', () => {
    expect(IntakeOrdersSearchSchema.parse({ status: 'na_cekanju' })).toEqual({})
  })

  it('drops a search term over the cap, and an empty one', () => {
    const tooLong = 'x'.repeat(INTAKE_SEARCH_MAX_LENGTH + 1)
    expect(IntakeOrdersSearchSchema.parse({ q: tooLong })).toEqual({})
    expect(IntakeOrdersSearchSchema.parse({ q: '' })).toEqual({})
  })

  it('lands on page 1 for a zero, a negative or a non-number page', () => {
    expect(IntakeOrdersSearchSchema.parse({ page: 0 })).toEqual({})
    expect(IntakeOrdersSearchSchema.parse({ page: -3 })).toEqual({})
    expect(IntakeOrdersSearchSchema.parse({ page: 'abc' })).toEqual({})
    expect(IntakeOrdersSearchSchema.parse({ page: 1.5 })).toEqual({})
  })

  it('lands on the default page size for an out-of-range or string value', () => {
    expect(IntakeOrdersSearchSchema.parse({ pageSize: 100 })).toEqual({})
    expect(IntakeOrdersSearchSchema.parse({ pageSize: '25' })).toEqual({})
  })

  it('keeps the good params when only one of them is bad', () => {
    expect(IntakeOrdersSearchSchema.parse({ view: 'deleted', status: 'u_radu', page: 3 })).toEqual({
      status: 'u_radu',
      page: 3,
    })
  })
})

describe('IntakeOrdersSearchSchema round-trips valid params', () => {
  it('leaves a fully populated search untouched', () => {
    const search = {
      status: 'u_radu',
      q: 'astra',
      view: 'unfinished',
      page: 3,
      pageSize: 50,
    }
    expect(IntakeOrdersSearchSchema.parse(search)).toEqual(search)
  })

  it('accepts a bare /prijem', () => {
    expect(IntakeOrdersSearchSchema.parse({})).toEqual({})
  })

  it('accepts each page size the pager offers', () => {
    for (const pageSize of [10, 25, 50]) {
      expect(IntakeOrdersSearchSchema.parse({ pageSize })).toEqual({ pageSize })
    }
  })

  it('trims a search term instead of dropping it', () => {
    expect(IntakeOrdersSearchSchema.parse({ q: '  astra  ' })).toEqual({ q: 'astra' })
  })

  it('accepts a term exactly at the cap', () => {
    const atCap = 'x'.repeat(INTAKE_SEARCH_MAX_LENGTH)
    expect(IntakeOrdersSearchSchema.parse({ q: atCap })).toEqual({ q: atCap })
  })
})
