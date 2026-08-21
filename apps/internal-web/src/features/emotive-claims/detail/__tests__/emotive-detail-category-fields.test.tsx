import { setLocale } from '@mr/i18n'
import { claimCategoryFieldsForCategoryOptions } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  EMOTIVE_CLAIM_FORM_DEFAULTS,
  formValuesToCreateInput,
} from '../../create/emotive-claim-create-schemas.js'

describe('the claim form carries the category answers', () => {
  it('sends them on create', () => {
    setLocale('sr', { reload: false })

    const input = formValuesToCreateInput({
      ...EMOTIVE_CLAIM_FORM_DEFAULTS,
      mrNumber: 'MR-1/26',
      customerId: '55555555-5555-4555-8555-555555555555',
      categoryId: '99999999-9999-4999-8999-999999999999',
      categoryFieldValues: { obradjeni_deo: 'glava' },
      engineTypeId: '66666666-6666-4666-8666-666666666666',
      dateOfClaim: '2026-05-01',
    })

    // Without this the wizard's dashed group would collect answers nobody ever stored.
    expect(input.categoryFieldValues).toEqual({ obradjeni_deo: 'glava' })
  })

  it('exposes a query for the fields of one category, retired rows included', () => {
    // The detail has to be able to NAME a field the office has since switched off.
    const options = claimCategoryFieldsForCategoryOptions('cat-1')
    expect(options.queryKey).toEqual([
      'claim-category-fields',
      'reference',
      { categoryId: 'cat-1', activeOnly: false, includeOptions: true },
    ])
  })
})
