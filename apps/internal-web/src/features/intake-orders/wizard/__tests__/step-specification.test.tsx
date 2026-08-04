import { setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyIntakeWizardValues, type IntakeWizardValues } from '../intake-wizard-state.js'
import { IntakeSpecList, StepSpecification } from '../step-specification.js'

function valuesWith(overrides: Partial<IntakeWizardValues> = {}): IntakeWizardValues {
  return { ...emptyIntakeWizardValues(), ...overrides }
}

describe('StepSpecification', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('adds a line on Enter and clears the field for the next one', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    render(<StepSpecification values={valuesWith()} onPatch={onPatch} />)

    const input = screen.getByPlaceholderText('Dodaj uslugu i pritisni Enter')
    await user.type(input, 'Zamena ulja{Enter}')

    expect(onPatch).toHaveBeenCalledWith({ services: ['Zamena ulja'] })
    expect(input).toHaveValue('')
  })

  it('adds through the button as well as the key', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    render(<StepSpecification values={valuesWith()} onPatch={onPatch} />)

    await user.type(screen.getByPlaceholderText('Dodaj materijal i pritisni Enter'), 'Filter ulja')
    const addButtons = screen.getAllByRole('button', { name: '+ Dodaj' })
    await user.click(addButtons[1] as HTMLElement)

    expect(onPatch).toHaveBeenCalledWith({ materials: ['Filter ulja'] })
  })

  it('refuses a blank line rather than adding an empty row to a signed document', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    render(<StepSpecification values={valuesWith()} onPatch={onPatch} />)

    await user.type(screen.getByPlaceholderText('Dodaj uslugu i pritisni Enter'), '   {Enter}')

    expect(onPatch).not.toHaveBeenCalled()
  })

  /**
   * Two identical lines are legitimate — the same service can be listed twice — so removal has to
   * go by position. Removing by value would delete both.
   */
  it('removes the line at the position tapped, even when two lines read the same', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    render(
      <StepSpecification
        values={valuesWith({ services: ['Pranje', 'Pranje', 'Balansiranje'] })}
        onPatch={onPatch}
      />,
    )

    const removeButtons = screen.getAllByRole('button', { name: 'Obriši uslugu' })
    await user.click(removeButtons[0] as HTMLElement)

    expect(onPatch).toHaveBeenCalledWith({ services: ['Pranje', 'Balansiranje'] })
  })

  it('numbers the lines from one, in the order they were entered', () => {
    render(
      <StepSpecification values={valuesWith({ services: ['Prva', 'Druga'] })} onPatch={vi.fn()} />,
    )

    expect(screen.getByText('Prva')).toBeInTheDocument()
    expect(screen.getByText('Druga')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('carries the note only on the materials card, and without the "U radu" restriction', () => {
    render(<StepSpecification values={valuesWith()} onPatch={vi.fn()} />)

    const notes = screen.getAllByText('Usluge i materijal mogu da se dopunjuju i kasnije.')
    expect(notes).toHaveLength(1)
  })
})

describe('IntakeSpecList — an async onChange', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  function renderList(onChange: (items: string[]) => void | Promise<void>) {
    return render(
      <IntakeSpecList
        title="Usluge"
        items={[]}
        placeholder="Dodaj uslugu i pritisni Enter"
        removeLabel="Obriši uslugu"
        onChange={onChange}
      />,
    )
  }

  /**
   * On the detail every add is a `PATCH`. Clearing the input before it lands would roll the list
   * back and destroy the line the serviser typed, with nothing left to retry from.
   */
  it('keeps the typed line when the change is refused', async () => {
    const user = userEvent.setup()
    renderList(vi.fn().mockRejectedValue(new Error('patch failed')))

    const input = screen.getByPlaceholderText('Dodaj uslugu i pritisni Enter')
    await user.type(input, 'Zamena ulja{Enter}')

    expect(input).toHaveValue('Zamena ulja')
  })

  it('clears the field once the change lands', async () => {
    const user = userEvent.setup()
    renderList(vi.fn().mockResolvedValue(undefined))

    const input = screen.getByPlaceholderText('Dodaj uslugu i pritisni Enter')
    await user.type(input, 'Zamena ulja{Enter}')

    expect(input).toHaveValue('')
  })
})
