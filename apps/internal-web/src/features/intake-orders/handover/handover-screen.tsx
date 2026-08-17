import { m } from '@mr/i18n'
import {
  handOverIntakeOrder,
  intakeOrderKeys,
  skipIntakeOrderHandover,
  type IntakeOrderDetail,
} from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'

import { InternalButton } from '~/components/internal-button'
import { showInternalToast } from '~/lib/internal-toast'

import { CardCondition } from '../detail/card-condition'
import { CardDamages } from '../detail/card-damages'
import { CAPTION, CARD } from '../detail/detail-styles'
import { INTAKE_STATUS_LABELS } from '../intake-status'
import {
  IntakeSignaturePad,
  isSignatureFilled,
  signatureStrokesToPath,
  type SignatureStrokes,
} from '../wizard/intake-signature-pad'

/** One of the two lists the owner is being shown before he signs. */
function WorkList({ caption, items }: { caption: string; items: readonly string[] }): ReactElement {
  return (
    <section className={cn(CARD, 'flex flex-col gap-[11px] px-5 py-[18px]')}>
      <h2 className={CAPTION}>{caption}</h2>
      {items.map((item, index) => (
        <div
          key={`${index}-${item}`}
          className="flex items-baseline gap-3 rounded-[10px] bg-mri-inbg px-3 py-[9px]"
        >
          <span className="font-mono text-[11px] text-mri-text2">{index + 1}</span>
          <span className="min-w-0 break-words text-sm text-mri-text">{item}</span>
        </div>
      ))}
    </section>
  )
}

/** A screen that cannot do its job says why in one sentence, instead of showing dead pads. */
function HandoverClosed({ orderId, reason }: { orderId: string; reason: string }): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/prijem/$id"
        params={{ id: orderId }}
        className="font-mono text-[11px] text-mri-text2 transition-colors hover:text-mri-text"
      >
        {m.intake_detail_back()}
      </Link>
      <p className="text-[14.5px] text-mri-text2">{reason}</p>
    </div>
  )
}

/**
 * Primopredaja — where the vehicle goes back and two people sign for it.
 *
 * Top to bottom it is the handover sheet itself: what was received, what was done to it, the
 * statement being signed, then the two pads. The paper the owner walks out with is rendered from
 * these same facts (`@mr/intake-document`), so the screen and the sheet cannot say different things.
 *
 * `preuzeto` is reachable from here and from the office's escape below, and from nowhere else in the
 * serviser's flow: the detail header's last rung now navigates here instead of moving the status.
 */
export function IntakeHandoverScreen({
  order,
  technicianName,
  canHandOver,
  canSkip,
}: {
  order: IntakeOrderDetail
  /** Whoever is standing at the car right now — never the order's serviser (the server agrees). */
  technicianName: string
  /**
   * `intake_orders.advance`. Its own prop rather than an assumption, because the way IN to this
   * screen opens for either permission: a `change_status`-only actor gets here legitimately, and
   * without this he would sign both pads and collect a 403 behind a generic toast.
   */
  canHandOver: boolean
  /** `intake_orders.change_status`. The server is the judge; this only keeps it off the screen. */
  canSkip: boolean
}): ReactElement {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [technicianStrokes, setTechnicianStrokes] = useState<SignatureStrokes>([])
  const [ownerStrokes, setOwnerStrokes] = useState<SignatureStrokes>([])
  const [confirmSkip, setConfirmSkip] = useState(false)

  // The whole intake tree hangs off one root — the detail, the list, the KPI row and the history all
  // change when a vehicle leaves, and invalidating the root cannot forget one of them.
  const leave = async (toast: string): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
    showInternalToast(toast)
    await navigate({ to: '/prijem/$id', params: { id: order.id } })
  }

  const handOver = useMutation({
    mutationFn: () =>
      handOverIntakeOrder(order.id, {
        technicianSignature: signatureStrokesToPath(technicianStrokes),
        ownerSignature: signatureStrokesToPath(ownerStrokes),
      }),
    onSuccess: (updated) => leave(m.intake_handover_done_toast({ number: updated.orderNumber })),
    onError: () => showInternalToast(m.intake_detail_action_failed()),
  })

  const skip = useMutation({
    mutationFn: () => skipIntakeOrderHandover(order.id),
    onSuccess: (updated) => {
      // ConfirmDialog never closes itself — left standing, its button fires a second call the
      // server answers 409, so a release that worked reports a failure.
      setConfirmSkip(false)
      return leave(
        m.intake_detail_advance_done({
          number: updated.orderNumber,
          status: INTAKE_STATUS_LABELS[updated.status](),
        }),
      )
    },
    onError: () => {
      setConfirmSkip(false)
      showInternalToast(m.intake_detail_action_failed())
    },
  })

  if (order.signedAt === null) {
    return <HandoverClosed orderId={order.id} reason={m.intake_handover_needs_signed_intake()} />
  }
  if (order.handoverSignedAt !== null) {
    return <HandoverClosed orderId={order.id} reason={m.intake_handover_already()} />
  }

  /**
   * Named, not recited. A footer reading "both signatures are required" at a serviser who has
   * already collected one is the dead-button-with-no-reason the wizard's step 1 was fixed for on
   * 14.08. — a list of nouns, so no grammatical form depends on how many there are.
   */
  const missing = [
    ...(isSignatureFilled(technicianStrokes) ? [] : [m.intake_handover_missing_technician()]),
    ...(isSignatureFilled(ownerStrokes) ? [] : [m.intake_handover_missing_owner()]),
  ]

  const nothingRecorded = order.services.length === 0 && order.materials.length === 0

  return (
    <div className="@container flex flex-col gap-[15px]">
      <header className="min-w-0">
        <Link
          to="/prijem/$id"
          params={{ id: order.id }}
          className="mb-2 inline-block font-mono text-[11px] text-mri-text2 transition-colors hover:text-mri-text"
        >
          {m.intake_detail_back()}
        </Link>

        <h1 className="font-mono text-[27px] font-extrabold tracking-[-0.02em] text-mri-text">
          {order.orderNumber}
        </h1>
        <p className="mt-1 text-[18px] font-bold text-mri-text">{m.intake_handover_title()}</p>
        <p className="mt-2 text-[14.5px] text-mri-text2">
          {order.vehicle} · <span className="font-mono">{order.plate}</span> · {order.ownerName}
        </p>
      </header>

      {/*
        Two columns from `lg` up, and the reason is measured rather than aesthetic. Stacked,
        everything the owner reads — header, damages, checklist, both work lists, the statement —
        comes to roughly 855 px before the pads begin, on a tablet 820 px tall. That is not a near
        miss that tighter spacing recovers, and it gets worse with every extra damage: the pads are
        pushed further down by the very orders that take longest to hand over.

        Side by side, the signing column starts at the top of the screen, so the pads are above the
        fold no matter how long the left column grows. The cost is paid knowingly (Nikola,
        2026-08-17): the pad keeps the 460:200 of the printed sheet — squash it and the signature
        comes out stretched on paper — so a narrower column is a shorter pad. On the serviser's
        1180 px tablet, which has no sidebar, the page is 1116 px wide and the drawing surface goes
        from ~509×221 to ~311×135. Still finger-sized, and the alternative was a scroll before
        every signature.

        380 px on the left is where the two costs meet: the damage map's `detail` variant is 152 px
        wide, so the list beside it keeps ~170 px — the width it already has on a phone today — and
        every pixel taken from here comes straight off the pad.

        ⚠ CONTAINER queries, not `lg:`. A viewport breakpoint does not know about the sidebar, and
        measuring proved what that costs: at 1180 px the office, which has one, has 861 px of room
        and `lg:grid` split it anyway — the pads came out 192×83, technically above the fold and
        far too small to sign on. The serviser, who has no sidebar, has 1116 px in the same window.
        So the split is asked of the room that actually exists: below 1050 px the screen stays one
        column with full-size pads and one scroll, which is what the office had before this change.
      */}
      <div className="flex flex-col gap-[15px] @[1050px]:grid @[1050px]:grid-cols-[minmax(0,380px)_minmax(0,1fr)] @[1050px]:items-start">
        {/*
          Its own container, and not decoration. `CardCondition` asks `@min-[860px]` whether it has
          room for four checklist columns; on this screen there was no container at all before, so
          the query never matched and it correctly stayed at two. Adding one at the root made the
          card measure the WHOLE page instead of the column it sits in — it went to four columns
          inside 380 px and broke "Vehicle registration" across a line mid-word. A component's
          query has to be answered by the box it actually occupies.
        */}
        <div className="@container flex min-w-0 flex-col gap-[15px]">
          <h2 className={CAPTION}>{m.intake_handover_section_received()}</h2>
          {/* Both cards are reads of a signed order, so the walk-around happened by definition —
              this screen refuses to open on an unsigned intake a few lines above. */}
          <CardDamages order={order} damageRecorded />
          <CardCondition order={order} />

          {nothingRecorded ? (
            /* ONE sentence for both lists, as the paper prints it: two headings over two voids read
               as two different absences, and there is only one — nothing was recorded as done. */
            <section className={cn(CARD, 'px-5 py-[18px]')}>
              <h2 className={cn(CAPTION, 'mb-2')}>{m.intake_handover_section_services()}</h2>
              <p className="text-[13.5px] italic text-mri-text2">{m.intake_handover_no_work()}</p>
            </section>
          ) : (
            <>
              {order.services.length === 0 ? null : (
                <WorkList caption={m.intake_handover_section_services()} items={order.services} />
              )}
              {order.materials.length === 0 ? null : (
                <WorkList caption={m.intake_handover_section_materials()} items={order.materials} />
              )}
            </>
          )}
        </div>

        {/* Capped, or a 27" office monitor stretches the pads so tall that the button they enable
            lands below the fold — the same bug this split exists to remove, arriving from the
            other end. */}
        <div className="flex min-w-0 flex-col gap-[15px] @[1050px]:max-w-[860px]">
          {/* No pads for someone the server would refuse: he reached this screen legitimately (the
              way in opens for either permission), and two signature pads over a button that answers
              403 are the same broken promise as any other dead control. He can still read what the
              vehicle arrived with, and still record the release below. */}
          {canHandOver ? null : (
            <p className="text-[13.5px] italic text-mri-text2">{m.intake_handover_not_yours()}</p>
          )}

          {canHandOver ? (
            <>
              <p className="max-w-[760px] text-sm leading-[1.6] text-mri-text2">
                {m.intake_handover_statement()}
              </p>

              {/* Side by side from 720 px of ROOM — below the split's own threshold on purpose, so
                  the office's single column keeps the two pads beside each other exactly as it did
                  before, instead of stacking them into a page twice as long. */}
              <div className="flex flex-col gap-[18px] @[720px]:flex-row @[720px]:items-start">
                <IntakeSignaturePad
                  title={m.intake_handover_signature_technician()}
                  name={technicianName}
                  strokes={technicianStrokes}
                  onChange={setTechnicianStrokes}
                />
                <IntakeSignaturePad
                  title={m.intake_handover_signature_owner()}
                  name={order.ownerName}
                  strokes={ownerStrokes}
                  onChange={setOwnerStrokes}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    'font-mono text-[11.5px] tracking-[0.05em]',
                    missing.length === 0 ? 'text-mri-text2' : 'text-mri-warn',
                  )}
                >
                  {missing.length === 0
                    ? m.intake_signature_ready()
                    : m.intake_hint_required({ fields: missing.join(', ') })}
                </span>

                <InternalButton
                  type="button"
                  variant="green"
                  disabled={missing.length > 0 || handOver.isPending}
                  onClick={() => handOver.mutate()}
                  className="ml-auto h-[52px] w-auto px-8"
                >
                  {m.intake_handover_action()}
                </InternalButton>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/*
        Quiet, below the rule, and only for the office: this is the door for the owner who turned up
        at 19:00 and drove away while nobody could sign anything. The order then permanently carries
        no handover document — which is exactly what makes it worth recording rather than hiding.
      */}
      {canSkip ? (
        <div className="border-t border-mri-border pt-3">
          <InternalButton
            type="button"
            variant="ghost"
            disabled={skip.isPending}
            onClick={() => setConfirmSkip(true)}
            className="h-9 w-auto px-3 text-[13px]"
          >
            {m.intake_handover_skip()}
          </InternalButton>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSkip}
        onOpenChange={setConfirmSkip}
        title={m.intake_handover_skip_confirm_title({ number: order.orderNumber })}
        description={m.intake_handover_skip_confirm_body({ number: order.orderNumber })}
        confirmLabel={m.intake_handover_skip()}
        pending={skip.isPending}
        onConfirm={() => skip.mutate()}
      />
    </div>
  )
}
