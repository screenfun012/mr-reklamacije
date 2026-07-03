// Some inspection reports were authored with a leading "CLIENT-VISIBLE:" marker.
// It's an internal tag, never meant for the client — strip it before display or
// PDF export. Shared so the portal UI and the API report builder stay in sync.
export function stripClientVisibleMarker(report: string): string {
  return report.replace(/^\s*client-visible\s*:\s*/i, '').trim()
}
