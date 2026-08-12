import { m } from '@mr/i18n'
import { useState, type ReactElement } from 'react'

/**
 * The `+` both write-in lists share — equipment on step 2, defects on step 3.
 *
 * Closed it is one button; open it is a field that KEEPS ITSELF OPEN after adding, because a
 * serviser standing at the car writes two or three in a row and closing after each one would make
 * him tap `+` again every time.
 *
 * A blank name simply disables the confirm. There is deliberately no error message: nothing has gone
 * wrong that needs explaining, and a worker reading an error while the customer waits is worse than
 * a button that plainly cannot be pressed (docs/25 §3.0).
 */
export function IntakeExtraRowAdder({
  label,
  placeholder,
  onAdd,
}: {
  label: string
  placeholder: string
  onAdd: (name: string) => void
}): ReactElement {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const trimmed = name.trim()

  const add = (): void => {
    if (trimmed.length === 0) {
      return
    }
    onAdd(trimmed)
    setName('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 w-fit cursor-pointer rounded-[10px] border border-dashed border-mri-border2 bg-transparent px-4 text-[13px] font-bold uppercase tracking-[0.05em] text-mri-text2 transition-colors hover:text-mri-text"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={name}
        placeholder={placeholder}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            // Not a form, so nothing would submit — but a wizard step lives inside one elsewhere,
            // and a stray submit here would send a half-filled patch.
            event.preventDefault()
            add()
            return
          }
          if (event.key === 'Escape') {
            setName('')
            setOpen(false)
          }
        }}
        className="mri-input h-11 min-w-0 flex-1 rounded-[10px] border border-mri-border2 bg-mri-inbg px-3 font-sans text-[13.5px] text-mri-text outline-none"
      />
      <button
        type="button"
        onClick={add}
        disabled={trimmed.length === 0}
        className="h-11 flex-none cursor-pointer rounded-[10px] border-0 bg-mri-btn px-5 text-[13px] font-extrabold uppercase tracking-[0.05em] text-mri-btnfg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {m.intake_extra_confirm()}
      </button>
    </div>
  )
}
