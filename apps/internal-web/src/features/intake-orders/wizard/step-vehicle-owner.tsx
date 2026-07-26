import { m } from '@mr/i18n'
import {
  IntakeArrivalMode,
  IntakeVehicleType,
  intakePlateLookupOptions,
  type IntakePlateLookupResponse,
} from '@mr/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactElement } from 'react'

import { InternalFieldGroup } from '~/components/internal-field-group'
import { InternalInput } from '~/components/internal-field'
import { InternalNote } from '~/components/internal-note'
import { IntakeChoiceButtons } from './intake-choice-buttons'
import { IntakePanel } from './intake-panel'
import type { IntakeWizardValues } from './intake-wizard-state'

const PLATE_LOOKUP_DEBOUNCE_MS = 400

const ARRIVAL_OPTIONS = [
  { value: IntakeArrivalMode.Driven, label: () => m.intake_arrival_dovezeno() },
  { value: IntakeArrivalMode.Towed, label: () => m.intake_arrival_doslepano() },
  { value: IntakeArrivalMode.Dragged, label: () => m.intake_arrival_dovuceno() },
] as const

const VEHICLE_TYPE_OPTIONS = [
  { value: IntakeVehicleType.Car, label: () => m.intake_vehicle_type_auto() },
  { value: IntakeVehicleType.Van, label: () => m.intake_vehicle_type_kombi() },
  { value: IntakeVehicleType.Pickup, label: () => m.intake_vehicle_type_kamionet() },
  { value: IntakeVehicleType.Suv, label: () => m.intake_vehicle_type_dzip() },
] as const

export interface StepVehicleOwnerProps {
  values: IntakeWizardValues
  onPatch: (patch: Partial<IntakeWizardValues>) => void
}

export function StepVehicleOwner({ values, onPatch }: StepVehicleOwnerProps): ReactElement {
  const [debouncedPlate, setDebouncedPlate] = useState(values.plate)
  /** The order whose data was copied in, so the offer is not made again in a loop. */
  const [appliedFrom, setAppliedFrom] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPlate(values.plate)
    }, PLATE_LOOKUP_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [values.plate])

  const { data } = useQuery(intakePlateLookupOptions(debouncedPlate))
  const match = debouncedPlate.trim() === values.plate.trim() ? (data?.match ?? null) : null

  // Editing the plate means it is a different vehicle — the previous offer no longer applies.
  useEffect(() => {
    setAppliedFrom(null)
  }, [values.plate])

  const applyMatch = (found: NonNullable<IntakePlateLookupResponse['match']>): void => {
    onPatch({
      vehicle: found.vehicle,
      vehicleType: found.vehicleType,
      vin: found.vin ?? '',
      ownerName: found.ownerName,
      ownerAddress: found.ownerAddress ?? '',
      ownerPhone: found.ownerPhone,
    })
    setAppliedFrom(found.orderNumber)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <IntakePanel title={m.intake_card_vehicle()} className="min-w-0 flex-1">
        {appliedFrom !== null ? (
          <InternalNote tone="ok" role="status" className="text-[13px]">
            {m.intake_plate_applied({ number: appliedFrom })}
          </InternalNote>
        ) : match !== null ? (
          <InternalNote tone="info" role="status" className="text-[13px]">
            <span className="flex flex-wrap items-center gap-2">
              {m.intake_plate_seen_before({
                number: match.orderNumber,
                date: new Date(match.receivedAt).toLocaleDateString(),
              })}
              <button
                type="button"
                onClick={() => applyMatch(match)}
                className="cursor-pointer font-semibold text-mri-info underline"
              >
                {m.intake_plate_apply()}
              </button>
            </span>
          </InternalNote>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <InternalFieldGroup id="intake-plate" label={m.intake_field_plate()} required>
            <InternalInput
              id="intake-plate"
              placeholder="BG 000-AA"
              value={values.plate}
              onChange={(event) => onPatch({ plate: event.target.value })}
              className="h-12 font-mono uppercase"
              autoComplete="off"
            />
          </InternalFieldGroup>

          <InternalFieldGroup id="intake-vehicle" label={m.intake_field_vehicle()} required>
            <InternalInput
              id="intake-vehicle"
              placeholder="npr. BMW 320d F30"
              value={values.vehicle}
              onChange={(event) => onPatch({ vehicle: event.target.value })}
              className="h-12"
              autoComplete="off"
            />
          </InternalFieldGroup>

          <InternalFieldGroup id="intake-vin" label={m.intake_field_vin()}>
            <InternalInput
              id="intake-vin"
              placeholder="17 znakova"
              value={values.vin}
              onChange={(event) => onPatch({ vin: event.target.value })}
              className="h-12 font-mono uppercase"
              autoComplete="off"
            />
          </InternalFieldGroup>

          <InternalFieldGroup id="intake-mileage" label={m.intake_field_mileage()}>
            <InternalInput
              id="intake-mileage"
              placeholder="0"
              value={values.mileage}
              onChange={(event) => onPatch({ mileage: event.target.value })}
              className="h-12 font-mono"
              inputMode="numeric"
              autoComplete="off"
            />
          </InternalFieldGroup>
        </div>

        <IntakeChoiceButtons
          legend={m.intake_field_arrival_mode()}
          options={ARRIVAL_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label(),
          }))}
          value={values.arrivalMode}
          onChange={(arrivalMode) => onPatch({ arrivalMode })}
        />

        <IntakeChoiceButtons
          legend={m.intake_field_vehicle_type()}
          options={VEHICLE_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label(),
          }))}
          value={values.vehicleType}
          onChange={(vehicleType) => onPatch({ vehicleType })}
          labelSize={14.5}
          divider={false}
        />
      </IntakePanel>

      <IntakePanel title={m.intake_card_owner()} className="w-full lg:w-[410px] lg:flex-none">
        <InternalFieldGroup id="intake-owner-name" label={m.intake_field_owner_name()} required>
          <InternalInput
            id="intake-owner-name"
            placeholder="Ime vlasnika"
            value={values.ownerName}
            onChange={(event) => onPatch({ ownerName: event.target.value })}
            className="h-12"
            autoComplete="off"
          />
        </InternalFieldGroup>

        <InternalFieldGroup id="intake-owner-address" label={m.intake_field_owner_address()}>
          <InternalInput
            id="intake-owner-address"
            placeholder="Ulica i grad"
            value={values.ownerAddress}
            onChange={(event) => onPatch({ ownerAddress: event.target.value })}
            className="h-12"
            autoComplete="off"
          />
        </InternalFieldGroup>

        <InternalFieldGroup id="intake-owner-phone" label={m.intake_field_owner_phone()} required>
          <InternalInput
            id="intake-owner-phone"
            placeholder="+381 6x xxx xxx"
            value={values.ownerPhone}
            onChange={(event) => onPatch({ ownerPhone: event.target.value })}
            className="h-12 font-mono"
            inputMode="tel"
            autoComplete="off"
          />
        </InternalFieldGroup>

        <InternalFieldGroup id="intake-owner-remarks" label={m.intake_field_owner_remarks()}>
          <textarea
            id="intake-owner-remarks"
            value={values.ownerRemarks}
            onChange={(event) => onPatch({ ownerRemarks: event.target.value })}
            rows={4}
            placeholder="Šta vlasnik prijavljuje…"
            className="mri-input min-h-[104px] rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 py-2.5 font-sans text-[13.5px] text-mri-text outline-none"
          />
        </InternalFieldGroup>
      </IntakePanel>
    </div>
  )
}
