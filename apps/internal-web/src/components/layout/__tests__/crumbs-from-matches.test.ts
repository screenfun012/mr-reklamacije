import { describe, expect, it } from 'vitest'

import { crumbsFromMatches } from '../crumbs-from-matches.js'

describe('crumbsFromMatches', () => {
  it('collects the static crumb of every matched route, in order, skipping routes without one', () => {
    expect(
      crumbsFromMatches([
        { staticData: {} },
        { staticData: { crumb: () => 'Reklamacije' } },
        { staticData: { crumb: () => 'Detalj' } },
      ]),
    ).toEqual(['Reklamacije', 'Detalj'])
  })

  it('takes a dynamic crumb from loaderData when the route has none of its own', () => {
    expect(
      crumbsFromMatches([
        { staticData: { crumb: () => 'Reklamacije' } },
        { staticData: {}, loaderData: { crumb: 'Mašinska obrada' } },
      ]),
    ).toEqual(['Reklamacije', 'Mašinska obrada'])
  })

  it('restarts the trail where a route asks for it — the wizard is not "under" the list', () => {
    expect(
      crumbsFromMatches([
        { staticData: { crumb: () => 'Reklamacije' } },
        { staticData: { crumb: () => 'Nova reklamacija', crumbResetsTrail: true } },
      ]),
    ).toEqual(['Nova reklamacija'])
  })

  it('drops an empty dynamic crumb (a category not yet loaded) without leaving a hole', () => {
    expect(
      crumbsFromMatches([
        { staticData: { crumb: () => 'Reklamacije' } },
        { staticData: {}, loaderData: { crumb: '' } },
      ]),
    ).toEqual(['Reklamacije'])
  })
})
