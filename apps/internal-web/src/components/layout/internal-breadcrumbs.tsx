import { m } from '@mr/i18n'
import { useMatches } from '@tanstack/react-router'

import { crumbsFromMatches } from './crumbs-from-matches'

/**
 * Prototype: `INTERNO / REKLAMACIJE / MAŠINSKA OBRADA` — mono 10.5px, tracking .16em, the
 * slashes at half opacity and the last part in the text colour.
 *
 * Hidden below `sm` like the eyebrow beside it: this row neither shrinks nor wraps, and at
 * phone width it used to push the whole header past the viewport. The page's own H1 says the
 * same thing there.
 */
export function InternalBreadcrumbs(): React.ReactElement {
  const matches = useMatches()
  const parts = [m.topbar_app_name(), ...crumbsFromMatches(matches)]

  return (
    <nav
      aria-label={m.topbar_breadcrumbs_label()}
      className="hidden min-w-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mri-text2 sm:block"
    >
      <ol className="flex min-w-0 items-center gap-[6px]">
        {parts.map((part, index) => (
          <li key={`${index}-${part}`} className="flex min-w-0 items-center gap-[6px]">
            {index > 0 ? (
              <span aria-hidden="true" className="opacity-50">
                /
              </span>
            ) : null}
            <span
              className={index === parts.length - 1 ? 'truncate text-mri-text' : 'truncate'}
              aria-current={index === parts.length - 1 ? 'page' : undefined}
            >
              {part}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
