import { m } from '@mr/i18n'
import {
  IntakeDamageType,
  intakeDamageTypeValues,
  intakeDamageZoneOf,
  type IntakeDamage,
} from '@mr/shared'
import { ConfirmDialog, cn } from '@mr/ui'
import { useState, type ReactElement } from 'react'

import { IntakeDamageMap, intakeDamageMarkerColour } from './intake-damage-map'
import { IntakePanel } from './intake-panel'
import { newDamageId, type IntakeWizardValues } from './intake-wizard-state'

const DAMAGE_TYPE_LABEL: Record<IntakeDamageType, () => string> = {
  [IntakeDamageType.Scratch]: () => m.intake_damage_type_ogrebotina(),
  [IntakeDamageType.Dent]: () => m.intake_damage_type_udubljenje(),
  [IntakeDamageType.Cracked]: () => m.intake_damage_type_puknuto(),
  [IntakeDamageType.Rust]: () => m.intake_damage_type_rdja(),
}

const VEHICLE_TYPE_LABEL = {
  auto: () => m.intake_vehicle_type_auto(),
  kombi: () => m.intake_vehicle_type_kombi(),
  kamionet: () => m.intake_vehicle_type_kamionet(),
  dzip: () => m.intake_vehicle_type_dzip(),
} as const

export interface StepDamagePhotosProps {
  values: IntakeWizardValues
  onPatch: (patch: Partial<IntakeWizardValues>) => void
}

/**
 * Step 3 — where the serviser records what the vehicle already looks like. A tap on the drawing
 * drops a numbered marker of the selected type; the list on the right is the same markers in the
 * same order, which is what keeps map, list and printed order from ever disagreeing.
 */
export function StepDamagePhotos({ values, onPatch }: StepDamagePhotosProps): ReactElement {
  const [damageType, setDamageType] = useState<IntakeDamageType>(IntakeDamageType.Scratch)
  /**
   * The number is captured when the dialog opens, not looked up while it is on screen: the list
   * renumbers the moment the damage leaves it, and a dialog that reads the index live asks
   * "Obrisati oštećenje 0?" for the split second before it closes.
   */
  const [removing, setRemoving] = useState<{ damage: IntakeDamage; number: number } | null>(null)

  const place = (point: { x: number; y: number }): void => {
    onPatch({
      damages: [
        ...values.damages,
        {
          id: newDamageId(),
          type: damageType,
          x: point.x,
          y: point.y,
          // The server derives the zone again and overwrites this, but the wire schema requires a
          // non-empty one, so a missing value fails in Zod before that ever runs.
          zone: intakeDamageZoneOf(values.vehicleType, point.x, point.y),
        },
      ],
    })
  }

  const remove = (damage: IntakeDamage): void => {
    onPatch({ damages: values.damages.filter((row) => row.id !== damage.id) })
    setRemoving(null)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <IntakePanel
        title={m.intake_card_damage_map()}
        headerClassName="gap-2.5"
        badge={
          <span className="rounded-full border border-mri-border2 bg-mri-inbg px-[9px] py-[3px] font-mono text-[9.5px] font-semibold tracking-[0.1em] text-mri-text2">
            {VEHICLE_TYPE_LABEL[values.vehicleType]()}
          </span>
        }
        action={<span className="text-[12.5px] text-mri-text2">{m.intake_map_hint()}</span>}
        className="min-w-0 flex-1 gap-[11px] px-5 py-[18px]"
      >
        <div className="grid min-h-0 flex-1 place-items-center rounded-xl border border-mri-border bg-mri-inbg p-2">
          <IntakeDamageMap
            vehicleType={values.vehicleType}
            damages={values.damages}
            onPlace={place}
          />
        </div>

        <div className="flex gap-2">
          {intakeDamageTypeValues.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setDamageType(type)}
              aria-pressed={damageType === type}
              className={cn(
                'h-12 flex-1 cursor-pointer rounded-[9px] border text-[13px] transition-colors duration-200 motion-reduce:transition-none',
                // The selected tint is red for every type — it deliberately does NOT preview the
                // marker's own colour, which would read as four different controls.
                damageType === type
                  ? 'border-[rgba(237,28,36,0.42)] bg-[rgba(237,28,36,0.13)] font-bold text-mri-redh'
                  : 'border-mri-border2 bg-mri-inbg font-semibold text-mri-text2',
              )}
            >
              {DAMAGE_TYPE_LABEL[type]()}
            </button>
          ))}
        </div>
      </IntakePanel>

      <div className="flex w-full min-h-0 flex-col gap-[14px] lg:w-[520px] lg:flex-none">
        <IntakePanel
          title={m.intake_card_damage_list()}
          action={
            <span className="rounded-full bg-[rgba(237,28,36,0.13)] px-2.5 py-[3px] font-mono text-[13px] font-bold text-mri-redh">
              {values.damages.length}
            </span>
          }
          className="flex-none gap-[9px] px-[18px] py-4"
        >
          {values.damages.map((damage, index) => {
            const colour = intakeDamageMarkerColour(damage.type)
            return (
              <div
                key={damage.id}
                className="flex items-center gap-[11px] rounded-[10px] bg-mri-inbg px-2.5 py-2"
              >
                <span
                  className="grid size-[26px] flex-none place-items-center rounded-full font-mono text-xs font-bold"
                  style={{ background: colour.fill, color: colour.text }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  {m.intake_damage_row_label({
                    type: DAMAGE_TYPE_LABEL[damage.type](),
                    zone: damage.zone,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoving({ damage, number: index + 1 })}
                  aria-label={m.intake_damage_remove()}
                  className="h-11 w-9 flex-none cursor-pointer text-base text-mri-text2"
                >
                  ✕
                </button>
              </div>
            )
          })}

          {values.damages.length === 0 ? (
            <p className="px-2.5 py-3 text-[13.5px] italic text-mri-text2">
              {m.intake_damage_empty()}
            </p>
          ) : null}
        </IntakePanel>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={m.intake_damage_confirm_remove_title({ number: removing?.number ?? 0 })}
        description={m.intake_damage_confirm_remove_description()}
        confirmLabel={m.intake_damage_remove()}
        onConfirm={() => {
          if (removing !== null) {
            remove(removing.damage)
          }
        }}
      />
    </div>
  )
}
