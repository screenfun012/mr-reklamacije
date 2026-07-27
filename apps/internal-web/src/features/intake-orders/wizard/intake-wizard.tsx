import { m } from '@mr/i18n'
import {
  createIntakeOrder,
  deleteIntakeOrder,
  deleteIntakeOrderPhoto,
  intakeOrderDetailOptions,
  signIntakeOrder,
  intakeOrderKeys,
  updateIntakeOrder,
  type IntakeOrderDetail,
  type IntakeOrderPhoto,
} from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'

import { showInternalToast } from '~/lib/internal-toast'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'
import { IntakeOrderNumberField } from './intake-order-number-field'
import { IntakeStepperStrip } from './intake-stepper-strip'
import { IntakeWizardFooter, type IntakeHintTone } from './intake-wizard-footer'
import { IntakeWizardNote } from './intake-wizard-note'
import {
  INTAKE_WIZARD_STEP_COUNT,
  clearIntakeDraft,
  emptyIntakeWizardValues,
  readIntakeDraft,
  step1Complete,
  toCreateInput,
  toUpdateInput,
  valuesFromOrder,
  writeIntakeDraft,
  type IntakeDraftBuffer,
  type IntakeWizardValues,
} from './intake-wizard-state'
import { StepChecklist } from './step-checklist'
import { StepDamagePhotos } from './step-damage-photos'
import { StepSignatures } from './step-signatures'
import { StepSpecification } from './step-specification'
import { IntakeUploadChip } from './intake-upload-chip'
import {
  isSignatureFilled,
  signatureStrokesToPath,
  type SignatureStrokes,
} from './intake-signature-pad'
import { StepVehicleOwner } from './step-vehicle-owner'
import { useIntakePhotoQueue } from './use-intake-photo-queue'

/** Stable identity, so `photos` defaulting to it never re-renders step 3 for nothing. */
const EMPTY_PHOTOS: readonly IntakeOrderPhoto[] = []

const STEP_LABELS = [
  () => m.intake_step_1(),
  () => m.intake_step_2(),
  () => m.intake_step_3(),
  () => m.intake_step_4(),
  () => m.intake_step_5(),
] as const

/**
 * The five-step intake. Steps 1–2 are built (V-3); 3–5 are drawn and approved but land in
 * later phases, so the wizard walks into a reserved panel rather than pretending they are
 * missing — the stepper stays honest about how many steps there are.
 */
export function IntakeWizard(): ReactElement {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // The signing serviser is whoever is logged in — the order is his by construction.
  const { userName: technicianName } = useInternalAuthUser()

  const [values, setValues] = useState<IntakeWizardValues>(emptyIntakeWizardValues)
  const [step, setStep] = useState(1)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [numberTaken, setNumberTaken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  /** A buffer found on this tablet at mount — offered once, never forced. */
  const [foundDraft, setFoundDraft] = useState<IntakeDraftBuffer | null>(null)
  /**
   * Signatures live here rather than in `IntakeWizardValues`: those are sent on every step patch,
   * and a signature only ever travels through `/sign`. They are also NOT written to the tablet
   * buffer — re-signing after a reload costs seconds with the customer already standing there,
   * and a stored signature is the one thing that must not outlive the moment it was given.
   */
  const [technicianStrokes, setTechnicianStrokes] = useState<SignatureStrokes>([])
  const [ownerStrokes, setOwnerStrokes] = useState<SignatureStrokes>([])

  useEffect(() => {
    const draft = readIntakeDraft()
    if (draft !== null && draft.values.orderNumber.trim().length > 0) {
      setFoundDraft(draft)
    }
  }, [])

  // The buffer only has to survive a sleeping tablet between two step patches, so it is
  // written on every change — including `visibilitychange`, which is when iPadOS freezes the
  // page without warning.
  useEffect(() => {
    const draft: IntakeDraftBuffer = { orderId, step, values }
    writeIntakeDraft(draft)
    const onHide = (): void => {
      writeIntakeDraft(draft)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [orderId, step, values])

  const patch = useCallback((next: Partial<IntakeWizardValues>) => {
    setValues((prev) => ({ ...prev, ...next }))
  }, [])

  /** Read by `saveDamages`, which must send the markers as they are at the moment of the tap. */
  const valuesRef = useRef(values)
  valuesRef.current = values

  /**
   * The queue lives here rather than inside step 3 on purpose: a photo taken just before the
   * signature has to keep uploading after the serviser has moved on, and the server only treats a
   * late arrival as part of the intake — instead of an amendment that stamps the document — while
   * it comes from the order's own technician (docs/25 §3.6).
   */
  const photoQueue = useIntakePhotoQueue(orderId)

  // Only the photos: the wizard owns `damages` locally, and letting the server copy of those flow
  // back in mid-edit would fight the serviser's taps.
  const { data: photos = EMPTY_PHOTOS } = useQuery({
    ...intakeOrderDetailOptions(orderId ?? ''),
    enabled: orderId !== null,
    select: (order: IntakeOrderDetail) => order.photos,
  })

  const saveDamages = useCallback(async (): Promise<void> => {
    if (orderId === null) {
      return
    }
    await updateIntakeOrder(orderId, { damages: valuesRef.current.damages })
  }, [orderId])

  const deletePhoto = useCallback(
    async (attachmentId: string): Promise<void> => {
      if (orderId === null) {
        return
      }
      await deleteIntakeOrderPhoto(orderId, attachmentId)
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
    },
    [orderId, queryClient],
  )

  const adoptOrder = useCallback((order: IntakeOrderDetail) => {
    setOrderId(order.id)
    setValues(valuesFromOrder(order))
    setStep(order.draftStep ?? 1)
  }, [])

  const resumeBuffer = useCallback(() => {
    if (foundDraft === null) {
      return
    }
    setValues(foundDraft.values)
    setStep(foundDraft.step)
    setOrderId(foundDraft.orderId)
    setFoundDraft(null)
  }, [foundDraft])

  const discardBuffer = useCallback(() => {
    clearIntakeDraft()
    setFoundDraft(null)
  }, [])

  const resumeServerOrder = useCallback(
    (id: string) => {
      void (async () => {
        try {
          const order = await queryClient.fetchQuery(intakeOrderDetailOptions(id))
          adoptOrder(order)
          setFoundDraft(null)
          showInternalToast(m.intake_resume_loaded())
        } catch {
          showInternalToast(m.intake_resume_failed())
        }
      })()
    },
    [adoptOrder, queryClient],
  )

  /** Leaving step 1 is what creates the row: photos need a parent and the number is claimed. */
  const goForward = (): void => {
    void (async () => {
      setSaving(true)
      try {
        if (orderId === null) {
          const created = await createIntakeOrder(toCreateInput(values))
          setOrderId(created.id)
          // Create stamps draft_step = 1, so without this follow-up the server would think the
          // intake is still on step 1 and the resume offer would send him a step backwards.
          await updateIntakeOrder(created.id, toUpdateInput(values, step + 1))
        } else {
          await updateIntakeOrder(orderId, toUpdateInput(values, step + 1))
        }
        await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
        setStep((prev) => Math.min(INTAKE_WIZARD_STEP_COUNT, prev + 1))
      } catch {
        showInternalToast(m.intake_save_failed())
      } finally {
        setSaving(false)
      }
    })()
  }

  const discard = (): void => {
    void (async () => {
      try {
        if (orderId !== null) {
          await deleteIntakeOrder(orderId)
          await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
        }
        clearIntakeDraft()
        await navigate({ to: '/prijem' })
      } catch {
        showInternalToast(m.intake_discard_failed())
      }
    })()
  }

  const canLeaveStep1 = step1Complete(values) && !numberTaken
  const forwardDisabled = saving || (step === 1 && !canLeaveStep1)

  const bothSigned = isSignatureFilled(technicianStrokes) && isSignatureFilled(ownerStrokes)
  /**
   * Waiting is only right while the network is actually carrying photos. With no network, or with
   * one that already failed, the button works — a serviser must never stand in front of the
   * customer waiting for the hall's WiFi (docs/25 §3.6).
   */
  const blockedByUpload =
    bothSigned && photoQueue.pending > 0 && photoQueue.online && photoQueue.failed === 0
  const canFinish = bothSigned && !blockedByUpload

  const finish = (): void => {
    if (!bothSigned) {
      showInternalToast(m.intake_finish_need_signatures())
      return
    }
    if (blockedByUpload) {
      showInternalToast(m.intake_finish_still_uploading({ pending: photoQueue.pending }))
      return
    }
    if (orderId === null) {
      return
    }

    void (async () => {
      setSaving(true)
      try {
        await signIntakeOrder(orderId, {
          technicianSignature: signatureStrokesToPath(technicianStrokes),
          ownerSignature: signatureStrokesToPath(ownerStrokes),
          // Everything not yet on the server counts, failures included — otherwise the "not every
          // photo arrived" indicator reads zero for exactly the photos most likely lost.
          photosExpected: photos.length + photoQueue.outstanding,
        })
        await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
        clearIntakeDraft()
        showInternalToast(m.intake_signed_toast({ number: values.orderNumber.trim() }))
        await navigate({ to: '/prijem/$id', params: { id: orderId } })
      } catch {
        showInternalToast(m.intake_sign_failed())
      } finally {
        setSaving(false)
      }
    })()
  }

  /**
   * The prototype distinguishes four states on step 1, in this order — "type the number" comes
   * before "fill the fields", because with an empty number that is the only thing to do.
   */
  const hint = ((): { text: string; tone: IntakeHintTone } => {
    if (step === 3 && values.damages.length > 0) {
      // Counted by marker NUMBER, which is what a photo carries — the same 1-based position the
      // list shows. A reminder only: step 3 never blocks DALJE, because a serviser who cannot
      // move on learns to stop marking damage at all (docs/25 §3.4).
      const photographed = new Set(
        [
          ...photos.map((photo) => photo.damageId),
          ...photoQueue.entries.map((e) => e.damageId),
        ].filter((id): id is string => id !== null),
      )
      const missing = values.damages.filter((damage) => !photographed.has(damage.id)).length
      if (missing > 0) {
        return {
          text: m.intake_hint_photos_missing({ missing, total: values.damages.length }),
          tone: 'warn',
        }
      }
      return { text: m.intake_hint_photos_all(), tone: 'muted' }
    }
    if (step === 5) {
      if (!bothSigned) {
        return { text: m.intake_hint_sign_missing(), tone: 'warn' }
      }
      if (photoQueue.failed > 0) {
        return { text: m.intake_hint_photos_failed(), tone: 'warn' }
      }
      if (photoQueue.waiting > 0 || !photoQueue.online) {
        return { text: m.intake_hint_no_network(), tone: 'warn' }
      }
      if (photoQueue.pending > 0) {
        return { text: m.intake_hint_last_photo({ pending: photoQueue.pending }), tone: 'warn' }
      }
      return { text: m.intake_hint_ready_to_finish(), tone: 'muted' }
    }
    if (step === 4 && photoQueue.pending > 0) {
      // Deliberately muted, not amber: the photos going up in the background are the normal case,
      // not a warning — the prototype re-sets the colour to `--text2` here on purpose.
      return {
        text: m.intake_hint_photos_uploading({ pending: photoQueue.pending }),
        tone: 'muted',
      }
    }
    if (step !== 1) {
      return { text: m.intake_hint_step({ step }), tone: 'muted' }
    }
    if (values.orderNumber.trim().length === 0) {
      return { text: m.intake_hint_no_number(), tone: 'warn' }
    }
    if (numberTaken) {
      return { text: m.intake_hint_number_taken(), tone: 'bad' }
    }
    if (!step1Complete(values)) {
      return { text: m.intake_hint_required(), tone: 'warn' }
    }
    return { text: m.intake_hint_ready(), tone: 'muted' }
  })()

  return (
    <div className="-mx-4 -mb-[72px] -mt-9 flex h-[calc(100vh-59px)] flex-col overflow-hidden sm:-mx-8">
      {/* 59px = the sticky topbar plus its hairline border, measured — not 58 as the shell's
          `top-[58px]` suggests. One pixel out and the page grows a vertical scrollbar. */}
      <IntakeStepperStrip
        steps={STEP_LABELS.map((label) => label())}
        currentStep={step}
        chip={
          (step === 4 || step === 5) && photoQueue.outstanding > 0 ? (
            <IntakeUploadChip
              outstanding={photoQueue.outstanding}
              failed={photoQueue.failed}
              waiting={photoQueue.waiting}
              online={photoQueue.online}
            />
          ) : undefined
        }
        trailing={
          <IntakeOrderNumberField
            value={values.orderNumber}
            onChange={(orderNumber) => patch({ orderNumber })}
            taken={numberTaken}
          />
        }
      />

      <IntakeWizardNote
        orderNumber={values.orderNumber}
        step={step}
        currentOrderId={orderId}
        foundDraft={foundDraft}
        onResumeServer={resumeServerOrder}
        onResumeBuffer={resumeBuffer}
        onDiscardBuffer={discardBuffer}
        onTakenChange={setNumberTaken}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-[18px] sm:px-[26px]">
        {step === 1 ? <StepVehicleOwner values={values} onPatch={patch} /> : null}
        {step === 2 ? <StepChecklist values={values} onPatch={patch} /> : null}
        {step === 3 ? (
          <StepDamagePhotos
            values={values}
            onPatch={patch}
            orderId={orderId}
            photos={photos}
            queue={photoQueue}
            onSaveDamages={saveDamages}
            onDeletePhoto={deletePhoto}
          />
        ) : null}
        {step === 4 ? <StepSpecification values={values} onPatch={patch} /> : null}
        {step === 5 ? (
          <StepSignatures
            technicianName={technicianName}
            ownerName={
              values.ownerName.trim().length > 0
                ? values.ownerName.trim()
                : m.intake_signature_owner_fallback()
            }
            damageCount={values.damages.length}
            photoCount={photos.length + photoQueue.outstanding}
            technicianStrokes={technicianStrokes}
            ownerStrokes={ownerStrokes}
            onTechnicianChange={setTechnicianStrokes}
            onOwnerChange={setOwnerStrokes}
            bothSigned={bothSigned}
          />
        ) : null}
      </div>

      <IntakeWizardFooter
        hint={hint.text}
        hintTone={hint.tone}
        backDisabled={step === 1}
        nextDisabled={forwardDisabled}
        {...(step === INTAKE_WIZARD_STEP_COUNT
          ? {
              finish: {
                label: blockedByUpload
                  ? m.intake_action_finish_waiting()
                  : m.intake_action_finish(),
                waiting: blockedByUpload,
                ready: canFinish && !saving,
                onClick: finish,
              },
            }
          : {})}
        onDiscard={() => setDiscarding(true)}
        onBack={() => setStep((prev) => Math.max(1, prev - 1))}
        onNext={goForward}
      />

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={m.intake_discard_title()}
        description={m.intake_discard_description()}
        confirmLabel={m.intake_action_discard()}
        onConfirm={discard}
      />
    </div>
  )
}
