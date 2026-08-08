import { m } from '@mr/i18n'
import type { IntakeOrderDetail } from '@mr/shared'
import type { ReactElement } from 'react'

import { IntakeSpecList } from '../wizard/step-specification'
import { useUpdateIntakeSpec } from './use-update-intake-spec'

/**
 * Services and materials, editable for the life of the order (docs/25 §3.3.9, spec §4.6). NOT the
 * amend mode: these are the only two fields that stay free after signing, so no ⚠ stamp and no
 * amber banner — presenting them inside the edit mode would wrongly suggest the customer's paper
 * had been altered.
 *
 * No save button: every add and every ✕ is its own `PATCH`. The wizard's step 4 looks the same but
 * is not — there `onPatch` only moves local form state and ONE request carries the whole order when
 * the step advances. A signed order has no next step to batch into, so the alternative here is a
 * dirty-state save button on a screen the office opens to read.
 */
export function TabSpec({
  order,
  canUpdate,
}: {
  order: IntakeOrderDetail
  canUpdate: boolean
}): ReactElement {
  const update = useUpdateIntakeSpec(order.id)

  /*
   * `isPending` is the serialisation, and it is load-bearing. Both cards share one mutation, and
   * each PATCH sends a WHOLE array computed from what was on screen when it left. Two overlapping
   * edits therefore send two arrays that each omit the other's change: the second one wins on the
   * server, and if the first then fails its rollback restores a snapshot taken before both — the
   * screen ends up showing neither what the server holds nor what was typed. `IntakeSpecList`
   * guards its own add button with `sending`, but nothing guarded the ✕, and nothing at all guarded
   * the two cards against each other.
   *
   * `deletedAt` and the permission are the two states where the server would refuse anyway (409 and
   * 403) — an enabled field there is an offer the screen cannot keep.
   */
  const frozen = order.deletedAt !== null || !canUpdate || update.isPending

  return (
    // Two equal cards side by side at every width, as the prototype has it (`:616-631`). No
    // viewport breakpoint: the shell's sidebar collapses, so one viewport gives this body three
    // different widths — the reason `tab-overview.tsx` breaks on the container instead.
    <div className="flex gap-4">
      <IntakeSpecList
        title={m.intake_card_services()}
        items={order.services}
        placeholder={m.intake_service_add()}
        removeLabel={m.intake_service_remove()}
        // `mutateAsync`, not `mutate`: the list clears the typed line only once the change is
        // accepted, and a refusal can only reach it through a promise that actually rejects.
        onChange={async (services) => {
          await update.mutateAsync({ services })
        }}
        disabled={frozen}
      />
      <IntakeSpecList
        title={m.intake_card_materials()}
        items={order.materials}
        placeholder={m.intake_material_add()}
        removeLabel={m.intake_material_remove()}
        onChange={async (materials) => {
          await update.mutateAsync({ materials })
        }}
        disabled={frozen}
      />
    </div>
  )
}
