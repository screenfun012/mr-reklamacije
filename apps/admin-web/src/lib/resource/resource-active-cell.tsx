import { createElement, type ReactNode } from 'react'

const ACTIVE_PILL =
  'rounded-full bg-adm-grn/15 px-2.5 py-[3px] font-mono text-[9.5px] font-bold uppercase text-adm-grn'
const INACTIVE_PILL =
  'rounded-full bg-adm-gry/20 px-2.5 py-[3px] font-mono text-[9.5px] font-bold uppercase text-adm-gry'

/**
 * DA / NE as two quiet pills, per the prototype (`admin-prototip.dc.html`).
 *
 * They replace a green-vs-plain-text pairing that coloured only the exception. The prototype's
 * answer is better on the screens that actually exist: at 9.5px mono in a 15%-tint pill neither
 * value shouts, the column reads as one shape whichever way a row goes, and the eye still finds the
 * grey one — 76 "DA" pills on engine types cost nothing because they are the quiet state.
 *
 * A function rather than a component because the eight resource definitions are `.ts`, not `.tsx` —
 * renaming all eight to hold one cell's markup would be the tail wagging the dog.
 */
export function renderActiveCell(isActive: boolean, label: string): ReactNode {
  return createElement('span', { className: isActive ? ACTIVE_PILL : INACTIVE_PILL }, label)
}
