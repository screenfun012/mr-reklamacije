import { m } from '@mr/i18n'
import {
  createIntakeOrder,
  deleteIntakeOrder,
  intakeOrderDetailOptions,
  intakeOrderKeys,
  updateIntakeOrder,
  type IntakeOrderDetail,
} from '@mr/shared'
import { ConfirmDialog, Heading } from '@mr/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactElement } from 'react'

import { internalButtonClasses } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'
import { InternalNote } from '~/components/internal-note'
import { WizardStepper } from '~/components/wizard-stepper'
import { showInternalToast } from '~/lib/internal-toast'
import { IntakeOrderNumberField } from './intake-order-number-field'
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

  const hint = ((): { text: string; tone: 'warn' | 'ok' } => {
    if (step === 1 && numberTaken) {
      return { text: m.intake_hint_number_taken(), tone: 'warn' }
    }
    if (step === 1 && !step1Complete(values)) {
      return { text: m.intake_hint_required(), tone: 'warn' }
    }
    return { text: m.intake_hint_ready(), tone: 'ok' }
  })()

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5 pb-[104px]">
      <header className="flex flex-col gap-1.5">
        <Heading level="h1">{m.intake_new_order()}</Heading>
      </header>

      {foundDraft !== null ? (
        <InternalNote tone="warn" role="status">
          <span className="flex flex-wrap items-center gap-3 text-[13px]">
            {m.intake_draft_found({
              number: foundDraft.values.orderNumber,
              step: foundDraft.step,
            })}
            <button
              type="button"
              onClick={() => {
                setValues(foundDraft.values)
                setStep(foundDraft.step)
                setOrderId(foundDraft.orderId)
                setFoundDraft(null)
              }}
              className="cursor-pointer font-semibold text-mri-redh underline"
            >
              {m.intake_draft_resume()}
            </button>
            <button
              type="button"
              onClick={() => {
                clearIntakeDraft()
                setFoundDraft(null)
              }}
              className="cursor-pointer text-mri-text2 underline"
            >
              {m.intake_draft_discard()}
            </button>
          </span>
        </InternalNote>
      ) : null}

      <div className="flex flex-col gap-4 rounded-[14px] border border-mri-border bg-mri-surface px-5 pt-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <WizardStepper steps={STEP_LABELS.map((label) => label())} currentIndex={step - 1} />
        </div>
        <div className="pb-5 lg:pb-0">
          <IntakeOrderNumberField
            value={values.orderNumber}
            onChange={(orderNumber) => patch({ orderNumber })}
            onResume={resumeServerOrder}
            onTakenChange={setNumberTaken}
          />
        </div>
      </div>

      {step === 1 ? <StepVehicleOwner values={values} onPatch={patch} /> : null}
      {step === 2 ? <StepChecklist values={values} onPatch={patch} /> : null}
      {step >= 3 ? (
        <InternalCard className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
          <Construction className="size-8 text-mri-warn" aria-hidden="true" />
          <Heading level="h3">{STEP_LABELS[step - 1]?.() ?? ''}</Heading>
          <p className="text-mri-text2">{m.intake_placeholder_body()}</p>
        </InternalCard>
      ) : null}

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-mri-border bg-mri-hdr px-4 py-3 backdrop-blur-[14px] sm:px-8">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-3">
          <span
            className={
              hint.tone === 'warn'
                ? 'font-mono text-[10px] uppercase tracking-[0.14em] text-mri-warn'
                : 'font-mono text-[10px] uppercase tracking-[0.14em] text-mri-ok'
            }
          >
            {hint.text}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiscarding(true)}
              className={internalButtonClasses('ghost', 'h-12 w-auto px-4')}
            >
              {m.intake_action_discard()}
            </button>
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              disabled={step === 1}
              className={internalButtonClasses('outline', 'h-12 w-auto px-4')}
            >
              {m.intake_action_back()}
            </button>
            <button
              type="button"
              onClick={goForward}
              disabled={forwardDisabled}
              className={internalButtonClasses('primary', 'h-12 w-auto px-6')}
            >
              {m.intake_action_next()}
            </button>
          </div>
        </div>
      </footer>

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
