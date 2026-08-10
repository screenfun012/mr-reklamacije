/**
 * The printed sheet is the ONE place in internal-web where literal hex is correct. It is white
 * paper with no dark mode, so the theme-dependent `mri-*` tokens would print whatever theme the
 * operator happened to be sitting in. Everywhere else CLAUDE.md §5 still applies.
 *
 * The solid red band replaces the prototype's thin red eyebrow: Nikola's decision (2026-08-10) is
 * that this paper must look like the other forms the customer already gets ("Obaveze kupca"),
 * which carry solid black and red bands.
 */
export const PRINT_BAND =
  'bg-[#ed1c24] px-[11px] py-[5px] font-mono text-[10px] font-extrabold uppercase tracking-[0.16em] text-white'

/** The small red caption above a block that carries no band of its own. */
export const PRINT_EYEBROW =
  'font-mono text-[8.5px] font-bold uppercase tracking-[0.2em] text-[#ed1c24]'

export const PRINT_FIGURE_LABEL = 'font-mono text-[8.5px] tracking-[0.16em] text-[#54555b]'

export const PRINT_FIGURE = 'font-mono text-[19px] font-bold'

export const PRINT_RULE = 'h-px bg-[#e6e7e9]'
