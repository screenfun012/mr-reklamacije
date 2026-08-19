/**
 * The panel's own controls, as the prototype draws them (`design_handoff_admin_panel/`).
 *
 * Class strings rather than components, and admin-local rather than in `@mr/ui`: every one of these
 * would otherwise have to be either a new shared component (which internal-web and portal-web would
 * inherit without asking) or a fresh copy of the same twelve utilities at each call site. The same
 * shape `field-control-styles.ts` uses for the shared ones.
 */

/** Mono caps above a field. */
export const admLabelClassName =
  'font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground'

/** Text input, select, anything a person types into. The focus ring is the brand red. */
export const admFieldClassName =
  'h-11 w-full rounded-[9px] border border-mr-border-strong bg-adm-inbg px-[13px] text-[14px] text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-mr-brand focus:shadow-[0_0_0_3px_rgba(237,28,36,0.18)] disabled:cursor-not-allowed disabled:opacity-60'

/**
 * A value that cannot be changed any more — a catalogue code after creation. Dashed, so it reads as
 * a field that has been closed rather than as one that failed to render.
 */
export const admLockedFieldClassName =
  'flex h-11 w-full items-center gap-2 rounded-[9px] border border-dashed border-mr-border-strong bg-adm-inbg px-[13px] font-mono text-[14px] font-semibold text-muted-foreground'

/** The one filled button in a dialog: save, confirm, proceed. Never red — see the prototype's §1. */
export const admPrimaryButtonClassName =
  'h-[46px] flex-1 cursor-pointer rounded-[10px] bg-adm-btn px-5 text-[12.5px] font-extrabold uppercase tracking-[0.05em] text-adm-btn-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

/** Its neighbour: cancel, back out, leave things as they are. */
export const admSecondaryButtonClassName =
  'h-[46px] flex-1 cursor-pointer rounded-[10px] border border-mr-border-strong bg-adm-inbg px-5 text-[12.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
