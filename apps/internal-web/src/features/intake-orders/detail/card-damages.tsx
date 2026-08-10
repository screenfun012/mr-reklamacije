import { m } from '@mr/i18n'
import {
  IntakeDamageType,
  intakeDamageTypeValues,
  intakeDamageZoneOf,
  type IntakeOrderDetail,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useState, type ReactElement } from 'react'

import { INTAKE_DAMAGE_TYPE_LABELS } from '../intake-labels'
import { IntakeDamageMap, intakeDamageMarkerColour } from '../wizard/intake-damage-map'
import { newDamageId } from '../wizard/intake-wizard-state'
import { CAPTION, CARD, FIELD_KEY } from './detail-styles'
import type { IntakeAmendEditing } from './use-intake-amend'

/**
 * "Šema" and "Nedostaci" — one card, read and corrected in place. In edit mode the drawing takes a
 * tap (`IntakeDamageMap` switches to a crosshair on its own the moment it is given `onPlace`) and
 * every defect row gets a ✕.
 *
 * The ✕ deliberately does NOT confirm, unlike the wizard's: here the whole buffer is discarded by
 * "Otkaži", so a per-marker question would be confirming nothing. The photos of a removed marker
 * survive on the server and only lose their number — the save dialog is where that is said, once.
 */
export function CardDamages({
  order,
  damageRecorded,
  amend,
}: {
  order: IntakeOrderDetail
  /** Whether anybody has walked around the car yet — decided once, by the tab, for both cards. */
  damageRecorded: boolean
  amend?: IntakeAmendEditing | undefined
}): ReactElement {
  const [damageType, setDamageType] = useState<IntakeDamageType>(IntakeDamageType.Scratch)

  const damages = amend === undefined ? order.damages : amend.buffer.damages

  const place = (point: { x: number; y: number }): void => {
    if (amend === undefined) {
      return
    }
    amend.patch({
      damages: [
        ...amend.buffer.damages,
        {
          id: newDamageId(),
          type: damageType,
          x: point.x,
          y: point.y,
          // The server derives the zone again and overwrites it, but the wire schema requires a
          // non-empty one, so a missing value fails in Zod before that ever runs.
          zone: intakeDamageZoneOf(order.vehicleType, point.x, point.y),
        },
      ],
    })
  }

  return (
    <section className={cn(CARD, 'flex min-w-0 flex-1 gap-[18px] px-5 py-[18px]')}>
      <div className="flex flex-none flex-col gap-2.5">
        <h2 className={CAPTION}>{m.intake_detail_card_scheme()}</h2>
        <div className="grid flex-1 place-items-center">
          <IntakeDamageMap
            vehicleType={order.vehicleType}
            damages={damages}
            variant="detail"
            {...(amend === undefined ? {} : { onPlace: place })}
          />
        </div>

        {amend === undefined ? null : (
          <div
            role="group"
            aria-label={m.intake_damage_type_pick()}
            className="grid w-[170px] grid-cols-2 gap-[6px]"
          >
            {intakeDamageTypeValues.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDamageType(type)}
                aria-pressed={damageType === type}
                className={cn(
                  'h-10 cursor-pointer rounded-[8px] border text-[11.5px] transition-colors',
                  // The selected tint is red for every type — it deliberately does NOT preview the
                  // marker's own colour, which would read as four different controls.
                  damageType === type
                    ? 'border-[rgba(237,28,36,0.42)] bg-[rgba(237,28,36,0.13)] font-bold text-mri-redh'
                    : 'border-mri-border2 bg-mri-inbg font-semibold text-mri-text2',
                )}
              >
                {INTAKE_DAMAGE_TYPE_LABELS[type]()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
        <h2 className={CAPTION}>{m.intake_detail_card_damages()}</h2>

        {damages.map((damage, index) => {
          const colour = intakeDamageMarkerColour(damage.type)
          return (
            <div
              key={damage.id}
              className="flex items-center gap-[11px] rounded-[10px] bg-mri-inbg px-3 py-[9px]"
            >
              <span
                className="grid size-6 flex-none place-items-center rounded-full font-mono text-[11px] font-bold"
                style={{ background: colour.fill, color: colour.text }}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-[13.5px] text-mri-text">
                {m.intake_damage_row_label({
                  type: INTAKE_DAMAGE_TYPE_LABELS[damage.type](),
                  zone: damage.zone,
                })}
              </span>
              {amend === undefined ? null : (
                <button
                  type="button"
                  onClick={() =>
                    amend.patch({
                      damages: amend.buffer.damages.filter((row) => row.id !== damage.id),
                    })
                  }
                  aria-label={m.intake_damage_remove()}
                  className="h-10 w-[34px] flex-none cursor-pointer text-[15px] text-mri-text2 transition-colors hover:text-mri-redh"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}

        {damages.length === 0 ? (
          <p className="text-[13.5px] italic text-mri-text2">
            {damageRecorded ? m.intake_detail_no_damage() : m.intake_detail_damage_pending()}
          </p>
        ) : null}

        <div className={cn(FIELD_KEY, 'mt-1')}>{m.intake_field_owner_remarks()}</div>
        <p className="text-[13.5px] italic leading-[1.6] text-mri-text2">
          {order.ownerRemarks ?? m.intake_detail_no_remarks()}
        </p>
      </div>
    </section>
  )
}
