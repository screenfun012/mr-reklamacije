/**
 * The chrome a card the DETAIL itself draws shares: radius 14, as the prototype has every card on
 * this screen (`prijem-prototip-v2.dc.html:560-645`). The tabs are separate files by design, so
 * without one home the same literals get retyped per tab.
 *
 * The Specifikacija tab is the deliberate exception — it reuses the wizard's `IntakeSpecList`, whose
 * `IntakePanel` is radius 15. Reusing the component that already owns the add/remove behaviour beats
 * matching a pixel; accepted drift, not an oversight (task 11).
 */
export const CARD = 'rounded-[14px] border border-mri-border bg-mri-surface'

export const CAPTION =
  'font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh'

/** Everything the prototype writes where a value is missing (`prijem-prototip-v2.dc.html:1391`). */
export const DASH = '—'
