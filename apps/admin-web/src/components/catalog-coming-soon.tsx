import { m } from '@mr/i18n'
import { Heading, panelClassName } from '@mr/ui'
import type { ReactElement } from 'react'

export interface CatalogComingSoonProps {
  title: string
}

/**
 * A catalogue that has a place in the menu but no table behind it yet.
 *
 * Two of the intake catalogues are in this state: the lists are `IntakeDamageType` /
 * `IntakeArrivalMode` constants in code, the tables exist in the database and nothing reads them.
 * Keeping the entries visible is Nikola's call (19.08.2026) — so the screen has to say plainly what
 * is missing rather than imitate a working catalogue, which is the failure mode that got two
 * "coming soon" screens deleted on 18.08.
 */
export function CatalogComingSoon({ title }: CatalogComingSoonProps): ReactElement {
  return (
    <div className="space-y-6">
      <Heading level="h1">{title}</Heading>
      <div className={`${panelClassName} px-6 py-12 text-center`}>
        <p className="mx-auto max-w-xl text-sm italic text-muted-foreground">
          {m.admin_catalog_coming_soon_body()}
        </p>
      </div>
    </div>
  )
}
