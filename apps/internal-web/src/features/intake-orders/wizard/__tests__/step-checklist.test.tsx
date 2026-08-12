import { m, setLocale } from '@mr/i18n'
import type { IntakeChecklistItemListItem } from '@mr/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyIntakeWizardValues, type IntakeWizardValues } from '../intake-wizard-state.js'
import { StepChecklist } from '../step-checklist.js'

/**
 * Rendered with the catalog as a PROP, the way step 3 is rendered with its photo queue: the wizard
 * owns the query because `toUpdateInput` needs the same list, and a step that fetched for itself
 * would need a provider here to say anything at all.
 */
function renderStepChecklist(
  items: readonly IntakeChecklistItemListItem[],
  values: IntakeWizardValues = emptyIntakeWizardValues(),
  onPatch = vi.fn(),
) {
  return { onPatch, ...render(<StepChecklist values={values} items={items} onPatch={onPatch} />) }
}

function catalogOf(count: number): IntakeChecklistItemListItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    code: `code${index}`,
    nameSr: `Stavka ${index}`,
    nameEn: `Item ${index}`,
    sortOrder: index * 10,
    isActive: true,
  }))
}

describe('StepChecklist', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('the total comes from the catalog, and an untouched list reads zero', () => {
    // Nine items in the catalog must read "0 / 9", and the WHOLE string is asserted, not the "/ 9"
    // fragment: the count and the total both live in this one label, and a fragment leaves the count
    // unpinned. Under `checklist[code] !== null` an absent code reads `undefined !== null` → true, so
    // a fresh step 2 would claim "9 / 9 potvrđeno" before the worker has tapped anything — a screen
    // lying about a document that is evidence (docs/25 §3.0). The browser caught the total half of
    // this shape once already in B ("Korak 2 / 5" over four steps).
    renderStepChecklist(catalogOf(9))

    expect(
      screen.getByText(m.intake_checklist_confirmed({ confirmed: 0, total: 9 })),
    ).toBeInTheDocument()
  })

  it('draws the items the catalog carries, by their catalog names', () => {
    renderStepChecklist(catalogOf(2))

    expect(screen.getByRole('group', { name: 'Stavka 0' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Stavka 1' })).toBeInTheDocument()
  })

  it('counts what the serviser answered, not what the map happens to hold', () => {
    const values: IntakeWizardValues = {
      ...emptyIntakeWizardValues(),
      /**
       * Two answered and BOTH shapes of "not answered": `code2` explicitly untouched, `code3` absent
       * from the map altogether — which is what a half-tapped step 2 really holds now that the wizard
       * starts from `{}`. The absent one is what separates this predicate from `!== null`; with every
       * key present the two are indistinguishable.
       */
      checklist: { code0: true, code1: false, code2: null },
    }

    renderStepChecklist(catalogOf(4), values)

    expect(screen.getByText(m.intake_checklist_confirmed({ confirmed: 2, total: 4 }))).toBeDefined()
  })

  it('records the tap against the item code', async () => {
    const user = userEvent.setup()
    const { onPatch } = renderStepChecklist(catalogOf(1))

    const group = screen.getByRole('group', { name: 'Stavka 0' })
    await user.click(screen.getByRole('button', { name: m.intake_checklist_yes() }))

    expect(group).toBeInTheDocument()
    expect(onPatch).toHaveBeenCalledWith({ checklist: { code0: true } })
  })

  /**
   * A fresh database has no checklist until the office fills one in (spec §3), and an empty card is
   * a dead end a serviser cannot get out of — `docs/25` §3.0 forbids exactly that. So the step says
   * who adds them and where, and does not offer a "0 / 0" nobody can act on.
   */
  it('offers the instruction instead of an empty card when nothing is set up', () => {
    renderStepChecklist([])

    expect(screen.getByText(m.intake_checklist_empty())).toBeInTheDocument()
    expect(screen.queryByText(m.intake_checklist_confirmed({ confirmed: 0, total: 0 }))).toBeNull()
    // The equipment note still works: it is the serviser's own words and does not need a catalog.
    expect(screen.getByLabelText(m.intake_field_equipment_note())).toBeInTheDocument()
  })
})

/**
 * Rows the serviser writes in because the shop's list does not offer them. They live on this order
 * alone — the catalog stays the admin's (docs/13).
 */
describe('StepChecklist — the rows the serviser writes in', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('counts them in the total, which is never a literal', () => {
    // Same class of bug the browser caught in part B ("Korak 2 / 5" over four steps): a total that
    // does not move when the list under it does.
    const values: IntakeWizardValues = {
      ...emptyIntakeWizardValues(),
      extraChecklist: [{ name: 'Gumeni patosnici', value: true }],
    }

    renderStepChecklist(catalogOf(8), values)

    expect(screen.getByText(m.intake_checklist_confirmed({ confirmed: 1, total: 9 }))).toBeDefined()
  })

  it('gives a written-in row the same DA/NE pair as a catalog row', async () => {
    const user = userEvent.setup()
    const { onPatch } = renderStepChecklist(catalogOf(2), {
      ...emptyIntakeWizardValues(),
      extraChecklist: [{ name: 'Gumeni patosnici', value: null }],
    })

    const group = screen.getByRole('group', { name: 'Gumeni patosnici' })
    await user.click(within(group).getByRole('button', { name: m.intake_checklist_no() }))

    expect(onPatch).toHaveBeenCalledWith({
      extraChecklist: [{ name: 'Gumeni patosnici', value: false }],
    })
  })

  it('adds on Enter and clears the field, because a serviser adds two or three at once', async () => {
    const user = userEvent.setup()
    const { onPatch } = renderStepChecklist(catalogOf(2))

    await user.click(screen.getByRole('button', { name: m.intake_extra_add_item() }))
    const field = screen.getByPlaceholderText(m.intake_extra_item_placeholder())
    await user.type(field, 'Gumeni patosnici{Enter}')

    expect(onPatch).toHaveBeenCalledWith({
      extraChecklist: [{ name: 'Gumeni patosnici', value: null }],
    })
    expect((field as HTMLInputElement).value).toBe('')
  })

  it('will not add a blank name, and says nothing about it', async () => {
    // Nothing to explain, so nothing is said — an error message here would be noise on a screen a
    // worker is using while a customer waits.
    const user = userEvent.setup()
    const { onPatch } = renderStepChecklist(catalogOf(2))

    await user.click(screen.getByRole('button', { name: m.intake_extra_add_item() }))
    await user.type(screen.getByPlaceholderText(m.intake_extra_item_placeholder()), '   ')

    expect(screen.getByRole('button', { name: m.intake_extra_confirm() })).toBeDisabled()
    expect(onPatch).not.toHaveBeenCalled()
  })

  it('removes one with a single tap, no dialog', async () => {
    const user = userEvent.setup()
    const { onPatch } = renderStepChecklist(catalogOf(2), {
      ...emptyIntakeWizardValues(),
      extraChecklist: [
        { name: 'Gumeni patosnici', value: true },
        { name: 'Kanister', value: null },
      ],
    })

    await user.click(screen.getAllByRole('button', { name: m.intake_extra_remove() })[0]!)

    expect(onPatch).toHaveBeenCalledWith({ extraChecklist: [{ name: 'Kanister', value: null }] })
  })

  it('offers the adder even when the catalog is empty', () => {
    // The catalog being empty is the office's mistake; the serviser must still be able to record
    // what he sees (docs/25 §3.0).
    renderStepChecklist([])

    expect(screen.getByRole('button', { name: m.intake_extra_add_item() })).toBeInTheDocument()
  })
})
