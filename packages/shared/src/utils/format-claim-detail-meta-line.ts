/** Joins non-empty claim header meta parts with a middle dot separator. */
export function formatClaimDetailMetaLine(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .filter((part): part is string => part !== null && part !== undefined && part.trim() !== '')
    .join(' · ')
}
