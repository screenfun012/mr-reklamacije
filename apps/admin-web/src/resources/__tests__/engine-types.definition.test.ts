import { describe, expect, it } from 'vitest'

import { engineTypesResourceDefinition as def } from '../engine-types.definition.js'

const base = { code: 'X', manufacturerId: 'm', notes: '' }

describe('engineTypesResourceDefinition displacement parsing', () => {
  it('keeps a plain integer', () => {
    expect(def.buildCreateBody({ ...base, displacementCc: '1998' }).displacementCc).toBe(1998)
  })

  it('rejects a separated value instead of truncating it to 1 (dot / comma / space)', () => {
    for (const value of ['1.998', '1,998', '1 998']) {
      expect(def.buildCreateBody({ ...base, displacementCc: value }).displacementCc).not.toBe(1)
    }
  })

  it('rejects a separated value on update too', () => {
    expect(def.buildUpdateBody({ ...base, displacementCc: '1.998' }).displacementCc).not.toBe(1)
  })

  it('treats an empty field as unset (undefined on create, null on update)', () => {
    expect(def.buildCreateBody({ ...base, displacementCc: '' }).displacementCc).toBeUndefined()
    expect(def.buildUpdateBody({ ...base, displacementCc: '' }).displacementCc).toBeNull()
  })
})
