export interface CrumbMatch {
  staticData: { crumb?: () => string; crumbResetsTrail?: boolean }
  loaderData?: unknown
}

function dynamicCrumb(loaderData: unknown): string | null {
  if (typeof loaderData !== 'object' || loaderData === null || !('crumb' in loaderData)) {
    return null
  }

  const crumb = (loaderData as { crumb: unknown }).crumb
  return typeof crumb === 'string' ? crumb : null
}

/**
 * The trail lives next to the routes, not in a pathname if-chain: a route declares its segment
 * as `staticData.crumb` (or returns `{ crumb }` from its loader when the name is data), and the
 * top bar folds the matches. A screen cannot be added without its name reaching the bar.
 */
export function crumbsFromMatches(matches: readonly CrumbMatch[]): string[] {
  let trail: string[] = []

  for (const match of matches) {
    if (match.staticData.crumbResetsTrail === true) {
      trail = []
    }

    // One place decides what an empty segment is: a category whose name has not loaded yet
    // must leave no hole in the trail, and no dangling slash either.
    const label = match.staticData.crumb?.() ?? dynamicCrumb(match.loaderData)
    if (label !== null && label.length > 0) {
      trail.push(label)
    }
  }

  return trail
}
