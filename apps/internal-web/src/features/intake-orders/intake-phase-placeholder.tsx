import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import type { ReactElement } from 'react'

import { internalButtonClasses } from '~/components/internal-button'

/**
 * Reserved place for a screen that is designed and approved but scheduled for a later phase
 * (the wizard is V-3…V-5, the detail is V-6). Same reasoning as the machining placeholder:
 * the route exists so the list's rows and its primary button lead somewhere, rather than the
 * navigation being wired up twice.
 */
export function IntakePhasePlaceholder({ title }: { title: string }): ReactElement {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col items-center gap-4 rounded-[12px] border border-dashed border-mri-border2 bg-mri-surface px-6 py-16 text-center">
      <Construction className="size-8 text-mri-warn" aria-hidden="true" />
      <Heading level="h2">{title}</Heading>
      <p className="text-mri-text2">{m.intake_placeholder_body()}</p>
      <Link to="/prijem" className={internalButtonClasses('outline', 'h-11 w-auto px-5')}>
        {m.intake_placeholder_back()}
      </Link>
    </div>
  )
}
