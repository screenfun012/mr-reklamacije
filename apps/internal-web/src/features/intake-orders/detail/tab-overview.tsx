import { getLocale, m } from '@mr/i18n'
import type { IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useState, type ReactElement, type ReactNode } from 'react'

import { internalIntlLocale } from '~/lib/internal-format'

import { INTAKE_ARRIVAL_MODE_LABELS } from '../intake-labels'
import { formatIntakeReceivedAtLong } from '../intake-status'
import { buildPhotoCells, type IntakePhotoCell } from '../wizard/intake-photo-grid'
import { IntakePhotoLightbox } from '../wizard/intake-photo-lightbox'
import { INTAKE_WIZARD_STEP_COUNT } from '../wizard/intake-wizard-state'
import { SIGNATURE_VIEW_BOX } from '../wizard/intake-signature-pad'
import { IntakeContactPhone } from './card-contact-phone'
import { CardCondition } from './card-condition'
import { CardDamages } from './card-damages'
import { CAPTION, CARD, DASH, FIELD_KEY } from './detail-styles'

/**
 * How far the intake actually got, in wizard steps. A draft parked on step 2 has recorded NOTHING
 * about damage, so "no damage found" would be a finding nobody made and a green 0 would be a clean
 * bill of health for a car nobody walked around. This is the same lie `conditionMark` above refuses
 * to print for an item nobody checked — the card just happens to be a different one.
 *
 * `draftStep` is the step he is STANDING on, so what is recorded is everything before it. A signed
 * intake has been through all five.
 */
function recordedThroughStep(order: IntakeOrderDetail): number {
  return order.signedAt !== null ? INTAKE_WIZARD_STEP_COUNT : (order.draftStep ?? 1) - 1
}

/** Damage and photos are step 3 (docs/25 §3.2). */
const STEP_DAMAGE = 3

function SignatureBox({ path, caption }: { path: string | null; caption: string }): ReactElement {
  return (
    <div className="flex-none">
      <div className="h-[50px] overflow-hidden rounded-[10px] border border-mri-border bg-mri-inbg">
        {path === null ? null : (
          // The stored path is normalized into the pad's own space, so the box comes from the
          // pad's constant rather than a retyped literal that would desync if it ever resizes.
          <svg
            viewBox={SIGNATURE_VIEW_BOX}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <path
              d={path}
              className="stroke-mri-sigink"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <p className="mt-[5px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
        {caption}
      </p>
    </div>
  )
}

/**
 * The Pregled tab — the archival read of the intake. Widths break on the CONTAINER, never on the
 * viewport: the shell's sidebar collapses and disappears, so one viewport gives this body three
 * different widths (the same reason `intake-orders-table.tsx` switched).
 */
export function TabOverview({
  order,
  canUpdate,
}: {
  order: IntakeOrderDetail
  /** Gates `IntakeContactPhone`'s own edit affordance below the owner-phone fact. */
  canUpdate: boolean
}): ReactElement {
  const [preview, setPreview] = useState<IntakePhotoCell | null>(null)

  const locale = getLocale()
  const cells = buildPhotoCells(order.id, order.photos, [], order.damages)
  const damageRecorded = recordedThroughStep(order) >= STEP_DAMAGE
  /** Both lists, always together: the paper prints one figure and so must every screen. */
  const damageCount = order.damages.length + order.extraDamages.length
  /*
   * Fuel gates on the SIGNATURE while damage above gates on the step, and the difference is not an
   * oversight. `fuel_level` is the only intake column that is NOT NULL with a default (schema:69),
   * so the row cannot tell "he set 4/8" from "nobody touched the dial" — a step gate would only
   * move the guess. An empty `damages` array recorded through step 3 IS a statement someone made;
   * a default 4 never was. The signature is the point where the number stops being a default and
   * becomes a reading both parties put their name to.
   *
   * Ceiling, on purpose: a signed order whose serviser never touched the dial still prints 4/8.
   * Closing that needs a nullable column plus a "not set" state on the gauge that the prototype
   * does not have — Nikola weighed it 2026-08-05 and chose this instead (spec
   * docs/superpowers/specs/2026-08-05-intake-open-questions-design.md §1).
   */
  const fuelReadValue =
    order.signedAt === null ? DASH : m.intake_fact_fuel_value({ level: order.fuelLevel })

  const facts: { label: string; value: ReactNode; className: string; cellClassName?: string }[] = [
    {
      label: m.intake_fact_received(),
      value: formatIntakeReceivedAtLong(order.receivedAt, locale),
      className: 'font-mono font-medium',
    },
    { label: m.intake_col_technician(), value: order.technicianName, className: '' },
    {
      label: m.intake_field_mileage(),
      value:
        order.mileage === null
          ? DASH
          : m.intake_fact_mileage_value({
              km: new Intl.NumberFormat(internalIntlLocale(locale)).format(order.mileage),
            }),
      className: 'font-mono font-medium',
    },
    {
      label: m.intake_field_arrival_mode(),
      value: INTAKE_ARRIVAL_MODE_LABELS[order.arrivalMode](),
      className: '',
    },
    { label: m.intake_fact_vin(), value: order.vin ?? DASH, className: 'font-mono font-medium' },
    {
      label: m.intake_field_owner_phone(),
      // The signed number keeps its own mono styling; `IntakeContactPhone` sets its own below it,
      // so the fact's shared wrapper className stays neutral rather than forcing mono onto the card.
      value: (
        <>
          <span className="font-mono font-medium">{order.ownerPhone}</span>
          <IntakeContactPhone order={order} canUpdate={canUpdate} />
        </>
      ),
      className: '',
      // This cell alone carries a live control, not just a read value. At the 1180px iPad-landscape
      // width the serviser actually holds, an even 1/4 grid column here is ~114px — a repeat of the
      // V-6-2 bug where a narrower-than-needed cell silently clipped digits off the phone it was
      // correcting, with no scrollbar to hint anything was wrong. Spanning the row gives the input
      // room instead of fighting a fixed min-width against a column that cannot grow.
      cellClassName: 'col-span-2 @min-[860px]:col-span-4',
    },
    {
      label: m.intake_fact_fuel(),
      value: fuelReadValue,
      className: 'font-mono font-semibold',
    },
    {
      label: m.intake_fact_damages(),
      // A dash, and no green, until somebody has actually walked around the car. The count is
      // markers PLUS the ones with no place on the drawing — this card sits directly above a list
      // that shows both, and the browser caught it reading "2" over four of them.
      value: damageRecorded ? String(damageCount) : DASH,
      className: cn(
        'font-mono font-semibold',
        !damageRecorded ? 'text-mri-text2' : damageCount > 0 ? 'text-mri-redh' : 'text-mri-grn',
      ),
    },
    { label: m.intake_field_owner_address(), value: order.ownerAddress ?? DASH, className: '' },
  ]

  return (
    // The lightbox is a SIBLING of the `@container`, not a child. `@container` compiles to
    // `container-type: inline-size`, which applies layout containment — and a contained element
    // becomes the containing block for `position: fixed` descendants. Inside it the full-screen
    // photo view would be positioned against this tab body and scroll away with the page.
    <>
      {/* 860, not 900: the container is the page box, not the window — viewport minus the 236px
          sidebar minus the shell's 64px padding. Design §4.12 names the 1180x820 iPad landscape as
          a two-column case, and 1180-236-64 = 880, which a 900 threshold collapsed to one column
          for every office reader on that tablet. The serviser was spared only because his single
          nav entry hides the rail. */}
      <div className="@container">
        <div className="flex flex-col gap-[14px] @min-[860px]:flex-row @min-[860px]:items-stretch @min-[860px]:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
            <section className={cn(CARD, 'px-5 py-[18px]')}>
              <h2 className={cn(CAPTION, 'mb-3.5')}>{m.intake_detail_card_basics()}</h2>
              <div className="grid grid-cols-2 gap-4 @min-[860px]:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.label} className={cn('min-w-0', fact.cellClassName)}>
                    <div className={cn(FIELD_KEY, 'mb-[5px]')}>{fact.label}</div>
                    <div className={cn('break-words text-sm text-mri-text', fact.className)}>
                      {fact.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <CardDamages order={order} damageRecorded={damageRecorded} />

            <CardCondition order={order} />
          </div>

          <div className="flex flex-col gap-[14px] @min-[860px]:w-[320px] @min-[860px]:flex-none">
            <section className={cn(CARD, 'flex flex-col gap-[11px] px-[18px] py-4')}>
              <h2 className={CAPTION}>
                {m.intake_card_photos()}
                <span className="ml-1 tracking-[0.1em] text-mri-text2">· {cells.length}</span>
              </h2>

              {cells.length === 0 ? (
                <p className="text-[13.5px] italic text-mri-text2">{m.intake_detail_no_photos()}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {cells.map((cell) => (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setPreview(cell)}
                      aria-label={m.intake_photo_preview()}
                      className="relative block aspect-square cursor-pointer overflow-hidden rounded-[8px] border border-mri-border2 bg-mri-inbg"
                    >
                      <img src={cell.url} alt="" className="size-full object-cover" />
                      {cell.number !== null && cell.numberColour !== null ? (
                        <span
                          className="absolute left-1 top-1 grid size-[19px] place-items-center rounded-full font-mono text-[10px] font-bold"
                          style={{
                            background: cell.numberColour.fill,
                            color: cell.numberColour.text,
                          }}
                        >
                          {cell.number}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/*
            A draft lands on this tab too (§4.8) and has no signatures — two empty boxes over
            "signed and locked" would assert a signature nobody gave.
          */}
            {order.signedAt === null ? null : (
              <section className={cn(CARD, 'flex flex-1 flex-col gap-2.5 px-[18px] py-3.5')}>
                <h2 className={cn(CAPTION, 'flex-none')}>{m.intake_detail_card_signatures()}</h2>

                <SignatureBox
                  path={order.technicianSignature}
                  caption={m.intake_detail_signature_technician({ name: order.technicianName })}
                />
                <SignatureBox
                  path={order.ownerSignature}
                  caption={m.intake_detail_signature_owner({ name: order.ownerName })}
                />
              </section>
            )}
          </div>
        </div>
      </div>

      {preview === null ? null : (
        <IntakePhotoLightbox cell={preview} orderId={order.id} onClose={() => setPreview(null)} />
      )}
    </>
  )
}
