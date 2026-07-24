/** One finding row — free text plus an operator-typed tag (both from @mr/shared's Finding). */
export interface ExportFinding {
  text: string
  type: string | null
}

/**
 * Excel O NAPOMENA — the multi-row findings folded into one cell as
 * `text (type); text (type)`. A finding with no type shows just its text.
 * Empty text rows are dropped; no findings → null (a blank cell).
 *
 * DOMACE only: findings are an internal document and stay out of the EMOTIVE
 * export, but Nikola put them in the DOMACE NAPOMENA column (docs/23).
 */
export function formatFindingsNote(
  findings: readonly ExportFinding[] | null | undefined,
): string | null {
  if (findings === null || findings === undefined) {
    return null
  }
  const parts = findings
    .map((finding) => {
      const text = finding.text.trim()
      if (text === '') {
        return null
      }
      const type = finding.type?.trim()
      return type ? `${text} (${type})` : text
    })
    .filter((part): part is string => part !== null)
  return parts.length === 0 ? null : parts.join('; ')
}
