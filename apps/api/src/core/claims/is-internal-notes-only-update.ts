export function isInternalNotesOnlyUpdate(input: object): boolean {
  const keys = Object.keys(input)
  return keys.length === 1 && keys[0] === 'internalNotes'
}
