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

import { InternalPage } from '~/components/layout/internal-page'
import { authClient } from '~/lib/auth-client'
import { showInternalToast } from '~/lib/internal-toast'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'
import { IntakeOrderNumberField } from './intake-order-number-field'
import { IntakeStepperStrip } from './intake-stepper-strip'
import { IntakeWizardFooter, type IntakeHintTone } from './intake-wizard-footer'
import { IntakeWizardNote } from './intake-wizard-note'
import {
  INTAKE_WIZARD_STEP_COUNT,
  INTAKE_WIZARD_STEPS,
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
] as const

/**
 * Three shapes a `?resume=` fetch can legitimately return and the wizard must refuse: a signed
 * order (adopting it would aim the wizard's patches at a frozen record, docs/25 §3.0.1, and every
 * step patch it sends would come back 422), a removed one, and one that
 * is somebody else's. A serviser's colleague 404s here on the row scope, but an operator holds
 * `view` + `create`, gets a 200 on any draft and can reach `/prijem/novi` — that pairing is what
 * would otherwise put another customer's name, phone and address on this tablet.
 *
 * The owner clause is checked only once the id is KNOWN. It arrives with the live session, and
 * refusing while it is still `undefined` would turn a serviser away from his own intake.
 */
function isAdoptable(order: IntakeOrderDetail, readerId: string | undefined): boolean {
  return (
    order.signedAt === null &&
    order.deletedAt === null &&
    (readerId === undefined || order.technicianId === readerId)
  )
}

/**
 * The five-step intake. Steps 1–2 are built (V-3); 3–5 are drawn and approved but land in
 * later phases, so the wizard walks into a reserved panel rather than pretending they are
 * missing — the stepper stays honest about how many steps there are.
 */
export interface IntakeWizardProps {
  /**
   * `/prijem/novi?resume=<id>` — open straight into this unfinished intake. docs/25 §3.3.4
   * promises resuming works on another tablet, and the detail's NASTAVI PRIJEM is the entrance.
   */
  resumeOrderId?: string
}

export function IntakeWizard({ resumeOrderId }: IntakeWizardProps = {}): ReactElement {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // The signing serviser is whoever is logged in — the order is his by construction. The email is
  // the buffer's owner mark: the tablet is shared, and it is the one identity available here
  // synchronously, so it cannot lose a race against hydration and refuse a man his own intake.
  const { userName: technicianName, userEmail } = useInternalAuthUser()
  /**
   * Who is reading this tablet right now. The id exists nowhere else on the client — the router
   * context carries only roles, name and email — so it comes from the live session, exactly as the
   * detail's draft bar reads it, and it is `undefined` until that session answers.
   *
   * A ref, never a dependency array: `resumeServerOrder` below is a dependency of the mount
   * effect, so an identity that changes on hydration would re-fire the whole resume — second
   * fetch, second toast, and a re-adopt that drops the serviser back to the step he has already
   * moved past.
   */
  const { data: session } = authClient.useSession()
  const reader = { id: session?.user?.id, email: userEmail }
  const readerRef = useRef(reader)
  readerRef.current = reader

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

  /**
   * The wizard is done with the tablet buffer — the intake was abandoned, or it is signed and we
   * are leaving. A ref rather than state: the listener below has to see this the moment it happens,
   * and nothing on screen looks different because of it.
   */
  const released = useRef(false)
  const releaseBuffer = useCallback(() => {
    released.current = true
    clearIntakeDraft()
  }, [])

  // Whether the draft is worth keeping at all is the buffer module's rule, not this screen's — the
  // two used to decide it separately, and this effect's mount write was the half that decided
  // nothing and overwrote a real draft with an empty one.
  useEffect(() => {
    // Asked for ONE intake by id, the tablet's own copy is not just irrelevant, it is dangerous:
    // it may hold a DIFFERENT draft, and offering that would put the serviser inside another
    // customer's car. The server copy below is the only truth in that case.
    if (resumeOrderId !== undefined) {
      return
    }
    const draft = readIntakeDraft(userEmail)
    if (draft !== null) {
      setFoundDraft(draft)
    }
  }, [userEmail, resumeOrderId])

  // The buffer only has to survive a sleeping tablet between two step patches, so it is
  // written on every change — including `visibilitychange`, which is when iPadOS freezes the
  // page without warning.
  useEffect(() => {
    if (released.current) {
      return
    }
    const draft: Omit<IntakeDraftBuffer, 'savedAt'> = { orderId, step, values, savedBy: userEmail }
    writeIntakeDraft(draft)
    const onHide = (): void => {
      // Releasing does not re-run this effect (a ref is not a dependency), so the listener
      // registered before the release is still live and still holds its snapshot. Without this
      // guard a tablet that sleeps during the navigation away writes the buffer straight back.
      if (released.current) {
        return
      }
      writeIntakeDraft(draft)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [orderId, step, values, userEmail])

  const patch = useCallback((next: Partial<IntakeWizardValues>) => {
    setValues((prev) => ({ ...prev, ...next }))
  }, [])

  /** Read by `saveDamages`, which must send the markers as they are at the moment of the tap. */
  const valuesRef = useRef(values)
  valuesRef.current = values

  /**
   * The queue lives here rather than inside step 3 on purpose: a photo taken just before the
   * signature has to keep uploading after the serviser has moved on, and the server accepts a late
   * arrival as part of the intake — instead of refusing it — only while it comes from the order's
   * own technician and only up to `photos_expected` (docs/25 §3.6).
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

  /**
   * `buffer` is this tablet's own copy of the SAME order, when it has one. It wins: a step patch
   * fires only in `goForward`, so a whole step's typing — step 4's services and materials — lives
   * nowhere but the buffer until DALJE is pressed, and `?resume=` stays in the address, so every
   * later reload of it would otherwise re-adopt the server copy straight over that work.
   */
  const adoptOrder = useCallback((order: IntakeOrderDetail, buffer: IntakeDraftBuffer | null) => {
    setOrderId(order.id)
    setValues(buffer?.values ?? valuesFromOrder(order))
    // Clamped: `draft_step` still holds 5 on orders parked on the OLD signatures step, and the
    // check constraint deliberately still allows it (spec §3). Five means "the last step", which
    // is now four.
    setStep(Math.min(INTAKE_WIZARD_STEP_COUNT, Math.max(buffer?.step ?? 1, order.draftStep ?? 1)))
  }, [])

  const resumeBuffer = useCallback(() => {
    if (foundDraft === null) {
      return
    }
    setValues(foundDraft.values)
    setStep(Math.min(INTAKE_WIZARD_STEP_COUNT, foundDraft.step))
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
          if (!isAdoptable(order, readerRef.current.id)) {
            // The same words a serviser already gets for a colleague's draft, whose GET 404s on
            // the row scope — from where he stands the two cases are the same refusal.
            showInternalToast(m.intake_resume_failed())
            return
          }
          const draft = readIntakeDraft(readerRef.current.email)
          adoptOrder(order, draft?.orderId === order.id ? draft : null)
          setFoundDraft(null)
          showInternalToast(m.intake_resume_loaded())
        } catch {
          showInternalToast(m.intake_resume_failed())
        }
      })()
    },
    [adoptOrder, queryClient],
  )

  // Declared after `resumeServerOrder` on purpose — a dependency array is evaluated during
  // render, so referencing the callback above its own declaration is a temporal-dead-zone crash.
  useEffect(() => {
    if (resumeOrderId === undefined) {
      return
    }
    resumeServerOrder(resumeOrderId)
  }, [resumeOrderId, resumeServerOrder])

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
      // The dialog stays open until we navigate, and its confirm button is a plain button — without
      // this a second tap fires a second DELETE while the first is still waiting on the hall's WiFi.
      setSaving(true)
      if (orderId !== null) {
        try {
          await deleteIntakeOrder(orderId)
          await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
        } catch {
          // We cannot tell a request that never arrived from one that committed and lost its
          // response, so the message claims neither. Abandoning is a local decision either way:
          // keeping the delete inside the same try as the release and the navigation made ODUSTANI
          // a button that only showed an error and left the dead order still being offered.
          showInternalToast(m.intake_discard_failed())
        }
      }
      releaseBuffer()
      await navigate({ to: '/prijem' })
    })()
  }

  const canLeaveStep1 = step1Complete(values) && !numberTaken
  /**
   * `numberTaken` blocks on EVERY step, not just the first. A resumed intake whose number was
   * signed on another tablet meanwhile still had DALJE live, and every patch it sent dead-ended
   * on a 422 the serviser could do nothing with.
   */
  const forwardDisabled =
    saving || numberTaken || (step === INTAKE_WIZARD_STEPS.Vehicle && !canLeaveStep1)

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
        // Only on the success path: a sign that genuinely failed leaves him standing at the car,
        // and taking his buffer away then would remove the net while he still needs it.
        releaseBuffer()
        showInternalToast(m.intake_signed_toast({ number: values.orderNumber.trim() }))
        // With the flag: the printed order is the next thing that has to happen, so the detail
        // opens it instead of leaving him on a screen with four tabs (`docs/25` §3.0).
        await navigate({ to: '/prijem/$id', params: { id: orderId }, search: { stampa: true } })
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
    if (step === INTAKE_WIZARD_STEPS.Damage && values.damages.length > 0) {
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
    if (step === INTAKE_WIZARD_STEPS.Signatures) {
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
    if (step === INTAKE_WIZARD_STEPS.Damage && photoQueue.pending > 0) {
      // Deliberately muted, not amber: the photos going up in the background are the normal case,
      // not a warning — the prototype re-sets the colour to `--text2` here on purpose.
      return {
        text: m.intake_hint_photos_uploading({ pending: photoQueue.pending }),
        tone: 'muted',
      }
    }
    // Above the step check, unlike every other step-1 branch: DALJE is now dead on every step
    // while the number belongs to somebody else, and a button that refuses without saying why
    // reads as broken. (Empty number cannot reach here — the check query needs one to answer.)
    if (numberTaken) {
      return { text: m.intake_hint_number_taken(), tone: 'bad' }
    }
    if (step !== 1) {
      return { text: m.intake_hint_step({ step, total: INTAKE_WIZARD_STEP_COUNT }), tone: 'muted' }
    }
    if (values.orderNumber.trim().length === 0) {
      return { text: m.intake_hint_no_number(), tone: 'warn' }
    }
    if (!step1Complete(values)) {
      return { text: m.intake_hint_required(), tone: 'warn' }
    }
    return { text: m.intake_hint_ready(), tone: 'muted' }
  })()

  return (
    /* The column no longer cancels the shell's padding with negative margins, no longer claims
       the whole viewport height, and no longer owns a scroll — it is an ordinary page capped at
       `narrow`, and the footer pins itself (see IntakeWizardFooter). The old `-mx-4 -mb-[72px]
       -mt-9 h-[calc(100vh-59px)] overflow-hidden` was what let it stretch edge to edge on a
       desktop, and its 59 was the topbar height copied by hand out of another file. */
    <InternalPage width="narrow" className="flex flex-col">
      <IntakeStepperStrip
        steps={STEP_LABELS.map((label) => label())}
        currentStep={step}
        chip={
          step === INTAKE_WIZARD_STEPS.Signatures && photoQueue.outstanding > 0 ? (
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

      <div className="px-4 py-[18px] sm:px-[26px]">
        {step === INTAKE_WIZARD_STEPS.Vehicle ? (
          <StepVehicleOwner values={values} onPatch={patch} />
        ) : null}
        {step === INTAKE_WIZARD_STEPS.Checklist ? (
          <StepChecklist values={values} onPatch={patch} />
        ) : null}
        {step === INTAKE_WIZARD_STEPS.Damage ? (
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
        {step === INTAKE_WIZARD_STEPS.Signatures ? (
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
        backDisabled={step === INTAKE_WIZARD_STEPS.Vehicle}
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
        pending={saving}
        onConfirm={discard}
      />
    </InternalPage>
  )
}
