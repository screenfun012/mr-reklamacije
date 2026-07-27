import { m } from '@mr/i18n'
import {
  createIntakeOrder,
  deleteIntakeOrder,
  intakeOrderDetailOptions,
  intakeOrderKeys,
  updateIntakeOrder,
  type IntakeOrderDetail,
} from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactElement } from 'react'

import { showInternalToast } from '~/lib/internal-toast'
import { IntakeOrderNumberField } from './intake-order-number-field'
import { IntakePanel } from './intake-panel'
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
import { StepVehicleOwner } from './step-vehicle-owner'

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

  const [values, setValues] = useState<IntakeWizardValues>(emptyIntakeWizardValues)
  const [step, setStep] = useState(1)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [numberTaken, setNumberTaken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  /** A buffer found on this tablet at mount — offered once, never forced. */
  const [foundDraft, setFoundDraft] = useState<IntakeDraftBuffer | null>(null)

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

  /**
   * The prototype distinguishes four states on step 1, in this order — "type the number" comes
   * before "fill the fields", because with an empty number that is the only thing to do.
   */
  const hint = ((): { text: string; tone: IntakeHintTone } => {
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
        {step === 3 ? <StepDamagePhotos values={values} onPatch={patch} /> : null}
        {step >= 4 ? (
          <IntakePanel title={STEP_LABELS[step - 1]?.() ?? ''}>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Construction className="size-8 text-mri-warn" aria-hidden="true" />
              <p className="text-mri-text2">{m.intake_placeholder_body()}</p>
            </div>
          </IntakePanel>
        ) : null}
      </div>

      <IntakeWizardFooter
        hint={hint.text}
        hintTone={hint.tone}
        backDisabled={step === 1}
        nextDisabled={forwardDisabled}
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
