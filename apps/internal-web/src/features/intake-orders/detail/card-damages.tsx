import { m } from '@mr/i18n'
import { type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { INTAKE_DAMAGE_TYPE_LABELS } from '../intake-labels'
import { IntakeDamageMap, intakeDamageMarkerColour } from '../wizard/intake-damage-map'
import { CAPTION, CARD, FIELD_KEY } from './detail-styles'

/**
 * "Šema" and "Nedostaci" — a pure read of what was recorded at intake. Both are frozen the moment
 * the order is signed (docs/25 §3.0), so this card has had nothing to correct or redraw since H.
 */
export function CardDamages({
  order,
  damageRecorded,
}: {
  order: IntakeOrderDetail
  /** Whether anybody has walked around the car yet — decided once, by the tab, for both cards. */
  damageRecorded: boolean
}): ReactElement {
  return (
    <section className={cn(CARD, 'flex min-w-0 flex-1 gap-[18px] px-5 py-[18px]')}>
      <div className="flex flex-none flex-col gap-2.5">
        <h2 className={CAPTION}>{m.intake_detail_card_scheme()}</h2>
        <div className="grid flex-1 place-items-center">
          <IntakeDamageMap
            vehicleType={order.vehicleType}
            damages={order.damages}
            variant="detail"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
        <h2 className={CAPTION}>{m.intake_detail_card_damages()}</h2>

        {order.damages.map((damage, index) => {
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
            </div>
          )
        })}

        {order.damages.length === 0 ? (
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
