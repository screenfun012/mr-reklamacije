import { describe, expect, it } from 'vitest'

import { emotiveClaimKeys } from '../emotive-claim-keys.js'

describe('emotiveClaimKeys', () => {
  it('builds stable list keys for equivalent filters', () => {
    const first = emotiveClaimKeys.list({ outcome: 'pending' }, 1, 10)
    const second = emotiveClaimKeys.list({ outcome: 'pending' }, 1, 10)

    expect(first).toEqual(second)
  })

  it('changes list key when page or pageSize changes', () => {
    const pageOne = emotiveClaimKeys.list({}, 1, 10)
    const pageTwo = emotiveClaimKeys.list({}, 2, 10)
    const largerPage = emotiveClaimKeys.list({}, 1, 25)

    expect(pageOne).not.toEqual(pageTwo)
    expect(pageOne).not.toEqual(largerPage)
  })

  it('builds detail keys under the detail namespace', () => {
    expect(emotiveClaimKeys.detail('claim-1')).toEqual(['emotive-claims', 'detail', 'claim-1'])
  })
})
