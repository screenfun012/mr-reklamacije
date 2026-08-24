/**
 * Where the chat's three columns stop fitting, and the classes that say so.
 *
 * One module because these numbers appear in more than one file, and a breakpoint that drifts by a
 * file is a band of widths where the list is neither a column nor a sheet.
 *
 * **Both numbers come from ONE measurement.** In the browser on 2026-08-24 the composer's fixed
 * furniture — the paperclip, the camera, SEND, the gaps and the padding — costs **217px** at every
 * width; everything past that is typing room, and 200px is about thirty characters at the
 * composer's size. So a conversation column needs 420px before it stops being a conversation.
 *
 * ```
 * CHAT_LIST_BREAKPOINT  = 252 (list)               + 420 = 672
 * CHAT_PANEL_BREAKPOINT = 252 (list) + 250 (panel) + 420 = 922
 * ```
 *
 * Checked against the container widths the app actually produces, which are NOT viewport widths:
 *
 * ```
 * viewport 1440 → 1138   list and panel both columns
 * viewport 1280 →  978   both columns
 * viewport 1180 →  878   panel lies over the conversation, list stays
 * viewport 1024 →  722   the worst case: the shell's sidebar only becomes a drawer BELOW lg,
 *                        so 960 gives 894 — more room than 1024 does
 * viewport  700 →  634   the list becomes a sheet too; typing room 415px
 * viewport  390 →  356   typing room 137px, where the whole column used to be 106px
 * ```
 *
 * ⚠ A NAMED container (`/chat`), never `lg:` and never a width measured in JavaScript — the server
 * and the browser would disagree and React would throw the whole tree away.
 *
 * ⚠ A `@min-[…]` naming a container nothing declares never matches, and nothing errors: the app
 * simply draws the narrow shape forever, on every monitor. That pair is what the test asserts.
 */
export const CHAT_LIST_BREAKPOINT = 672

export const CHAT_PANEL_BREAKPOINT = 922

/** The chat frame. Declares the container everything below queries, and hosts the two sheets. */
export const CHAT_FRAME_CLASSES =
  '@container/chat relative flex h-[calc(100vh-var(--mri-topbar-h)-6.75rem)] min-h-[520px] overflow-hidden rounded-xl border border-mri-border bg-mri-bg'

/** The conversation list while it is a column — the ordinary case. */
export const CHAT_LIST_COLUMN_CLASSES = 'hidden @min-[672px]/chat:flex'

/** The conversation list while it is out as a sheet, and how it goes back to being a column. */
export const CHAT_LIST_SHEET_CLASSES =
  'absolute inset-y-0 left-0 z-30 shadow-2xl @min-[672px]/chat:static @min-[672px]/chat:shadow-none'

/** What closes the sheet by clicking beside it. Exists only below the breakpoint. */
export const CHAT_LIST_BACKDROP_CLASSES =
  'absolute inset-0 z-20 cursor-default bg-black/40 @min-[672px]/chat:hidden'

/** The back arrow that calls the sheet out. Exists only below the breakpoint. */
export const CHAT_LIST_TOGGLE_CLASSES =
  'grid size-7 flex-none cursor-pointer place-items-center rounded-[7px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-text @min-[672px]/chat:hidden'

/** The claim panel: a sheet over the conversation until there is room for a third column. */
export const CHAT_PANEL_RESPONSIVE_CLASSES =
  'absolute inset-y-0 right-0 z-20 shadow-2xl @min-[922px]/chat:static @min-[922px]/chat:shadow-none'
