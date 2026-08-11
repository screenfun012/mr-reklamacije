import type { Locale } from '@mr/i18n'
import type { IntakeChecklist, IntakeChecklistItemListItem } from '@mr/shared'

/**
 * The checklist as its readers see it: the wire type, read-only. Derived from `IntakeChecklist`
 * rather than restated, so there is one definition of the shape now that the wire itself is an open
 * `{code: DA/NE}` map (task 4). The name survives because it says what the keys ARE — catalog codes,
 * not the eight fixed fields these screens were written against.
 */
export type IntakeChecklistByCode = Readonly<IntakeChecklist>

export interface IntakeChecklistRow {
  code: string
  name: string
  value: boolean | null
}

/**
 * The screen's language on screen, the paper's chosen language on the printed order — a foreign
 * customer signs an English work order while the office keeps working in Serbian, so the locale is
 * always an argument here and never read from the app.
 */
export function intakeChecklistItemName(item: IntakeChecklistItemListItem, locale: Locale): string {
  return locale === 'en' ? item.nameEn : item.nameSr
}

/**
 * Joins what an order RECORDED (a `{code: DA/NE}` map) with the names the catalog carries now.
 *
 * Two rules, both because a work order is evidence:
 *  · the rows are the ORDER's keys, never the catalog's — a newly added item must not retroactively
 *    change the count on a document somebody signed;
 *  · a code with no catalog row still renders, with the bare code as its name, rather than
 *    disappearing. A vanished row is a line the customer agreed to that we can no longer show.
 */
export function resolveIntakeChecklistRows(
  checklist: IntakeChecklistByCode,
  catalog: readonly IntakeChecklistItemListItem[],
  locale: Locale,
): IntakeChecklistRow[] {
  const byCode = new Map(catalog.map((item) => [item.code, item]))

  return Object.entries(checklist)
    .map(([code, value]) => {
      const item = byCode.get(code)
      return {
        code,
        name: item === undefined ? code : intakeChecklistItemName(item, locale),
        value,
        // Unknown codes sort last: they have no place in the shop's own order.
        sortOrder: item?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map(({ code, name, value }) => ({ code, name, value }))
}

/**
 * A row per item the catalog offers, all untouched — what a fresh intake records before anybody has
 * ticked anything. The rows have to BE in the map: an untouched row prints `—` (docs/25 §4.4), while
 * a row that is simply absent prints as nothing at all and the document quietly loses a line.
 */
export function untouchedIntakeChecklist(
  catalog: readonly IntakeChecklistItemListItem[],
): Record<string, null> {
  return Object.fromEntries(catalog.map((item) => [item.code, null]))
}
