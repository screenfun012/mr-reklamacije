import { m } from '@mr/i18n'
import { freeFieldsFor, type IntakeOrderDetail } from '@mr/shared'
import type { ReactElement } from 'react'

import { IntakeSpecList } from '../wizard/intake-spec-list'
import { useUpdateIntakeSpec } from './use-update-intake-spec'

/**
 * Services and materials, editable for the life of the order (docs/25 §3.3.9, spec §4.6) — two of
 * the three fields the signature freeze (docs/25 §3.0.1) leaves open, the third being the added
 * contact number. Every other field on a signed order is a read-only record of what the customer
 * received; these two are the repair job itself, tracked until Preuzeto, so editing them announces
 * nothing on the screen or on the paper — there is nothing to announce.
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

  /**
   * The SAME rule the server refuses by, not a second derivation of it: `freeFieldsFor` is in
   * `@mr/shared` precisely so both sides read one sentence. The handover signatures are the second
   * freeze — after them only the contact number moves — and until this was wired the ✕ and the add
   * line stayed live, sent their optimistic write, and the operator watched the line he had just
   * typed disappear behind a generic failure toast.
   */
  const free = freeFieldsFor(
    order.signedAt === null ? null : new Date(order.signedAt),
    order.handoverSignedAt === null ? null : new Date(order.handoverSignedAt),
  )
  // `null` is no freeze at all — an intake still being filled in, where everything is open.
  const specStillOpen = free === null || free.includes('services')

  /*
   * `isPending` is the serialisation, and it is load-bearing. Both cards share one mutation, and
   * each PATCH sends a WHOLE array computed from what was on screen when it left. Two overlapping
   * edits therefore send two arrays that each omit the other's change: the second one wins on the
   * server, and if the first then fails its rollback restores a snapshot taken before both — the
   * screen ends up showing neither what the server holds nor what was typed. `IntakeSpecList`
   * guards its own add button with `sending`, but nothing guarded the ✕, and nothing at all guarded
   * the two cards against each other.
   *
   * The permission is the state where the server would refuse anyway (403) — an enabled field there
   * is an offer the screen cannot keep.
   */
  const frozen = !canUpdate || update.isPending || !specStillOpen

  return (
    // Two equal cards side by side as the prototype has it (`:616-631`) — but only where two of
    // them fit. Everything in a panel that is not the input measures 186px (130px ADD button +
    // 10 gap + 44 padding + 2 border), so two panels plus their gap eat 388px before one character
    // can be typed; at a 363px phone the input was clamped to zero and the button spilled out.
    // The switch is 860, the number `tab-overview.tsx` already derived on this same body, so the
    // whole detail changes shape at one width rather than two.
    <div className="@container/spec flex flex-col gap-2.5">
      {/* Controls that vanish without a word read as a broken screen — the same rule the wizard's
          footer follows. This one sentence is the whole difference between "closed" and "gone". */}
      {specStillOpen ? null : (
        <p className="text-[13px] italic text-mri-text2">{m.intake_spec_frozen_handover()}</p>
      )}

      <div className="flex flex-col gap-4 @min-[860px]/spec:flex-row">
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
    </div>
  )
}
