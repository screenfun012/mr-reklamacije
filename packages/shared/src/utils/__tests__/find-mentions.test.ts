import { describe, expect, it } from 'vitest'

import { findMentions, MENTION_EVERYONE_ID, uniqueMentions } from '../find-mentions.js'

const UUID = 'a1b2c3d4-1111-4111-8111-abcdefabcdef'

describe('findMentions', () => {
  it('reads the id, not the name — that is what survives a rename', () => {
    const written = `@[Marko Marković](${UUID})`
    expect(findMentions(`zdravo ${written}, pogledaj`)).toEqual([
      { start: 7, end: 7 + written.length, label: 'Marko Marković', id: UUID },
    ])
  })

  it('reads @svi as its own reserved id', () => {
    const found = findMentions('@[svi](all) hitno')
    expect(found).toHaveLength(1)
    expect(found[0]?.id).toBe(MENTION_EVERYONE_ID)
    expect(found[0]?.label).toBe('svi')
  })

  it('ignores an id that is neither a uuid nor the reserved one', () => {
    // A message body is user input. Anything that is not a real address has to stay plain text —
    // a chip that points nowhere is worse than no chip.
    expect(findMentions('@[neko](drop table)')).toEqual([])
    expect(findMentions('@[neko](123)')).toEqual([])
    expect(findMentions('@[neko](all-of-them)')).toEqual([])
    // 36 characters of hex and dashes, so the pattern lets it through — only the uuid check does
    // not. Without this case the check is dead code that a green suite would happily keep.
    expect(findMentions('@[neko](111111111111111111111111111111111111)')).toEqual([])
    expect(findMentions('@[neko](------------------------------------)')).toEqual([])
  })

  it('leaves a bare @name alone — the prototype matched those, our model cannot', () => {
    // cet-prototip.dc.html:274 matches a capitalised word after @. That cannot survive a rename,
    // so the spec chose the id form and this parser reads only that.
    expect(findMentions('pitaj @Dragan za ovo')).toEqual([])
    expect(findMentions('posalji na mail@firma.rs')).toEqual([])
  })

  it('finds every mention in a line, in the order they were written', () => {
    const both = findMentions(`@[svi](all) i @[Ana](${UUID})`)
    expect(both.map((mention) => mention.id)).toEqual([MENTION_EVERYONE_ID, UUID])
  })

  it('does not choke on an unclosed mention', () => {
    expect(findMentions('@[Marko](')).toEqual([])
    expect(findMentions('@[Marko')).toEqual([])
    expect(findMentions('@[](x)')).toEqual([])
  })

  it('normalises the id, so the same person is one recipient however it was written', () => {
    const upper = UUID.toUpperCase()
    expect(findMentions(`@[Ana](${upper})`)[0]?.id).toBe(UUID)
  })

  it('mentions a person whose name is long — an account may carry 200 characters', () => {
    // At 80 the cap silently un-mentioned anybody with a long name: no error, no bell, and the
    // raw `@[Ime](uuid)` markup left sitting in the message.
    const long = 'A'.repeat(150)
    expect(findMentions(`@[${long}](${UUID})`)[0]?.id).toBe(UUID)

    // Past the cap it is words again, not a half-drawn chip.
    expect(findMentions(`@[${'A'.repeat(201)}](${UUID})`)).toEqual([])
  })

  it('uniqueMentions keeps the first of each person, in writing order', () => {
    const OTHER = 'b1b2c3d4-1111-4111-8111-abcdefabcdef'
    const found = uniqueMentions(`@[Prvi](${UUID}) @[Drugi](${OTHER}) @[Opet](${UUID})`)

    expect(found.map((mention) => mention.id)).toEqual([UUID, OTHER])
    expect(found[0]?.label).toBe('Prvi')
  })

  it('gives back offsets that cut the text exactly', () => {
    const text = `pre @[Ana](${UUID}) posle`
    const match = findMentions(text)[0]
    expect(text.slice(match?.start, match?.end)).toBe(`@[Ana](${UUID})`)
  })
})
