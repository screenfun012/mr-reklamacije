/**
 * Two letters for an avatar circle: the first letters of the first two words, or the first two
 * characters when there is only one word. Falls back to the email when the name is blank — during
 * the first SSR frame `useSession()` has no data and both are empty, hence the '?'.
 */
export function getInitials(name: string, email: string): string {
  const source = (name.trim().length > 0 ? name : email).trim()
  if (source.length === 0) {
    return '?'
  }
  const parts = source.split(/\s+/).filter((part) => part.length > 0)
  const initials =
    parts.length >= 2 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : source.slice(0, 2)
  return initials.toUpperCase()
}
