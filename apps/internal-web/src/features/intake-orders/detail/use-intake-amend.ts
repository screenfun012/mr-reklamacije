import { m } from '@mr/i18n'
import {
  intakeOrderKeys,
  sameIntakeChecklist,
  sameIntakeDamages,
  updateIntakeOrder,
  type IntakeChecklist,
  type IntakeDamage,
  type IntakeOrderDetail,
  type IntakeOrderUpdateInput,
} from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { optionalText } from '../wizard/intake-wizard-state'

/** Only what edit mode may change. Every other field of a signed order is frozen server-side. */
export interface IntakeAmendBuffer {
  ownerPhone: string
  fuelLevel: number
  checklist: IntakeChecklist
  equipmentNote: string
  damages: IntakeDamage[]
}

export function intakeAmendBufferFrom(order: IntakeOrderDetail): IntakeAmendBuffer {
  return {
    ownerPhone: order.ownerPhone,
    fuelLevel: order.fuelLevel,
    checklist: order.checklist,
    equipmentNote: order.equipmentNote ?? '',
    damages: [...order.damages],
  }
}

/**
 * 3–40 characters after trimming — the wire schema's own rule, checked here so the operator learns
 * WHICH field is wrong. The server's refusal arrives as an unaimed 400 that the screen can only
 * report as "the action failed".
 */
export function isAmendPhoneValid(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length >= 3 && trimmed.length <= 40
}

/**
 * Only the keys that actually changed. Sending the whole buffer would put `checklist`, `damages`
 * and `fuelLevel` in every request, so correcting a phone number would be recorded as a change to
 * the vehicle's recorded condition — and decision ① would be unreachable in practice.
 */
export function intakeAmendDiff(
  buffer: IntakeAmendBuffer,
  order: IntakeOrderDetail,
): IntakeOrderUpdateInput {
  const phone = buffer.ownerPhone.trim()
  const note = optionalText(buffer.equipmentNote) ?? null

  return {
    ...(phone === order.ownerPhone ? {} : { ownerPhone: phone }),
    ...(buffer.fuelLevel === order.fuelLevel ? {} : { fuelLevel: buffer.fuelLevel }),
    ...(note === order.equipmentNote ? {} : { equipmentNote: note }),
    ...(sameIntakeChecklist(buffer.checklist, order.checklist)
      ? {}
      : { checklist: buffer.checklist }),
    ...(sameIntakeDamages(buffer.damages, order.damages) ? {} : { damages: buffer.damages }),
  }
}

/** What a card needs to be editable. Declared here so a card never imports from its own tab. */
export interface IntakeAmendEditing {
  buffer: IntakeAmendBuffer
  patch: (next: Partial<IntakeAmendBuffer>) => void
  phoneValid: boolean
}

export interface IntakeAmend {
  active: boolean
  buffer: IntakeAmendBuffer
  patch: (next: Partial<IntakeAmendBuffer>) => void
  start: () => void
  cancel: () => void
  requestSave: () => void
  confirmOpen: boolean
  setConfirmOpen: (open: boolean) => void
  save: () => void
  pending: boolean
  phoneValid: boolean
  /** A marker was removed and it had photos — the dialog has to say they lose their number. */
  losesPhotoNumbers: boolean
}

/**
 * Edit mode, owned by the DETAIL PAGE rather than by a tab. The header and the tab body are
 * siblings under the route component, and the body is picked by a map — so switching tabs
 * unmounts the tab and would take the buffer with it. The URL is no help either: the tab links
 * pass a whole `search` object, which replaces any flag put there.
 */
export function useIntakeAmend(order: IntakeOrderDetail): IntakeAmend {
  const queryClient = useQueryClient()
  const [active, setActive] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [buffer, setBuffer] = useState<IntakeAmendBuffer>(() => intakeAmendBufferFrom(order))

  const patch = useCallback((next: Partial<IntakeAmendBuffer>) => {
    setBuffer((prev) => ({ ...prev, ...next }))
  }, [])

  const start = useCallback(() => {
    setBuffer(intakeAmendBufferFrom(order))
    setActive(true)
  }, [order])

  const cancel = useCallback(() => {
    // No question asked: nothing has left the screen, so there is nothing to lose but typing.
    setActive(false)
    setConfirmOpen(false)
  }, [])

  const save = useMutation({
    mutationFn: () => updateIntakeOrder(order.id, intakeAmendDiff(buffer, order)),
    onSuccess: async () => {
      setConfirmOpen(false)
      setActive(false)
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
      showInternalToast(m.intake_amend_saved({ number: order.orderNumber }))
    },
    // The mode stays open and the buffer is kept: the operator's typing is the only copy there is.
    onError: () => {
      setConfirmOpen(false)
      showInternalToast(m.intake_detail_action_failed())
    },
  })

  const phoneValid = isAmendPhoneValid(buffer.ownerPhone)

  const requestSave = useCallback(() => {
    if (!phoneValid) {
      showInternalToast(m.intake_amend_phone_invalid())
      return
    }
    // Checked BEFORE the dialog: confirming a permanent stamp and then having nothing happen is
    // the worst of both.
    if (Object.keys(intakeAmendDiff(buffer, order)).length === 0) {
      showInternalToast(m.intake_amend_nothing_changed())
      setActive(false)
      return
    }
    setConfirmOpen(true)
  }, [buffer, order, phoneValid])

  const kept = new Set(buffer.damages.map((damage) => damage.id))
  const losesPhotoNumbers = order.photos.some(
    (photo) => photo.damageId !== null && !kept.has(photo.damageId),
  )

  return {
    active,
    buffer,
    patch,
    start,
    cancel,
    requestSave,
    confirmOpen,
    setConfirmOpen,
    save: save.mutate,
    pending: save.isPending,
    phoneValid,
    losesPhotoNumbers,
  }
}
