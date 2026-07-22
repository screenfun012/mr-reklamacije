import { INTERNAL_APP_ROLES } from '@mr/shared'
import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'
import { createFileRoute } from '@tanstack/react-router'
import { Cog } from 'lucide-react'

import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/masinska-obrada')({
  beforeLoad: internalRequireRoles(INTERNAL_APP_ROLES),
  component: MasinskaObradaComponent,
})

/**
 * Reserved place for part machining (heads, blocks, crankshafts), which the app
 * has nowhere to record today. Deliberately a placeholder: the screen is being
 * designed with a colleague and more requirements are expected, so nothing is
 * built against guesses — no table, no API, no half-finished form. It exists so
 * the team can see the work is coming instead of asking where to enter it.
 */
function MasinskaObradaComponent(): React.ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Heading level="h1" className="mb-2">
          {m.machining_placeholder_title()}
        </Heading>
        <p className="text-sm text-mri-text2">{m.machining_placeholder_lead()}</p>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-[14px] border border-dashed border-mri-border2 bg-mri-surface px-6 py-14 text-center">
        <span
          aria-hidden="true"
          className="grid size-14 place-items-center rounded-full bg-mri-inbg text-mri-text2"
        >
          <Cog className="size-7" />
        </span>

        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mri-redh">
          {m.machining_placeholder_eyebrow()}
        </span>

        <p className="max-w-[520px] text-[15px] text-mri-text">{m.machining_placeholder_body()}</p>
        <p className="max-w-[520px] text-sm text-mri-text2">{m.machining_placeholder_note()}</p>
      </section>
    </div>
  )
}
