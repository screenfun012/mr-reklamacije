import { describe, expect, it } from 'vitest'

import {
  EMPTY_DRAFT,
  insertMention,
  reanchorMentions,
  toWireBody,
  type Draft,
} from '../composer-mentions'

const ANA = 'a1a1a1a1-1111-4111-8111-aaaaaaaaaaaa'
const MARKO = 'b2b2b2b2-2222-4222-8222-bbbbbbbbbbbb'

/** `zdravo @Ana Anić ` with the address kept beside it. */
function withAna(): Draft {
  return insertMention({ text: 'zdravo @an', mentions: [] }, 7, 10, {
    id: ANA,
    label: 'Ana Anić',
  }).draft
}

describe('what the person writing actually sees', () => {
  it('writes the words, not the address', () => {
    const { draft, caret } = insertMention({ text: 'zdravo @an', mentions: [] }, 7, 10, {
      id: ANA,
      label: 'Ana Anić',
    })

    expect(draft.text).toBe('zdravo @Ana Anić ')
    expect(draft.mentions).toEqual([{ start: 7, end: 16, id: ANA }])
    expect(caret).toBe(17)
  })

  it('but the server is given the address', () => {
    expect(toWireBody(withAna())).toBe(`zdravo @[Ana Anić](${ANA}) `)
  })

  it('tells two colleagues with the same name apart — which the words alone cannot', () => {
    // This shop really does have two accounts called "Nikola Admin". A body rebuilt by matching
    // names would send both mentions to whichever one it found first.
    let draft = insertMention(EMPTY_DRAFT, 0, 0, { id: ANA, label: 'Nikola Admin' }).draft
    draft = insertMention(draft, draft.text.length, draft.text.length, {
      id: MARKO,
      label: 'Nikola Admin',
    }).draft

    expect(draft.text).toBe('@Nikola Admin @Nikola Admin ')
    expect(toWireBody(draft)).toBe(`@[Nikola Admin](${ANA}) @[Nikola Admin](${MARKO}) `)
  })

  it('carries @svi as its reserved id', () => {
    const draft = insertMention(EMPTY_DRAFT, 0, 0, { id: 'all', label: 'svi' }).draft

    expect(draft.text).toBe('@svi ')
    expect(toWireBody(draft)).toBe('@[svi](all) ')
  })
})

describe('the address follows the words through an edit', () => {
  it('moves when something is typed BEFORE it', () => {
    const draft = withAna()
    const after = `pa ${draft.text}`

    expect(reanchorMentions(draft.mentions, draft.text, after)).toEqual([
      { start: 10, end: 19, id: ANA },
    ])
    expect(
      toWireBody({ text: after, mentions: reanchorMentions(draft.mentions, draft.text, after) }),
    ).toBe(`pa zdravo @[Ana Anić](${ANA}) `)
  })

  it('stays put when something is typed AFTER it', () => {
    const draft = withAna()
    const after = `${draft.text}vidimo se`

    expect(reanchorMentions(draft.mentions, draft.text, after)).toEqual([
      { start: 7, end: 16, id: ANA },
    ])
  })

  it('stops being a mention when the edit reaches into the name', () => {
    // A half-edited name must not keep silently addressing the person it used to name.
    const draft = withAna()
    const after = draft.text.replace('Anić', 'Anic')

    expect(reanchorMentions(draft.mentions, draft.text, after)).toEqual([])
  })

  it('stops being a mention when it is deleted outright', () => {
    const draft = withAna()

    expect(reanchorMentions(draft.mentions, draft.text, 'zdravo ')).toEqual([])
  })

  it('keeps the first and drops the second when only the second is edited', () => {
    let draft = insertMention(EMPTY_DRAFT, 0, 0, { id: ANA, label: 'Ana' }).draft
    draft = insertMention(draft, draft.text.length, draft.text.length, {
      id: MARKO,
      label: 'Marko',
    }).draft
    expect(draft.text).toBe('@Ana @Marko ')

    const after = draft.text.replace('Marko', 'Mark')

    expect(reanchorMentions(draft.mentions, draft.text, after)).toEqual([
      { start: 0, end: 4, id: ANA },
    ])
  })

  it('leaves everything alone when nothing changed', () => {
    const draft = withAna()

    expect(reanchorMentions(draft.mentions, draft.text, draft.text)).toEqual(draft.mentions)
  })
})
