import { m } from '@mr/i18n'
import { IntakeOrderStatus } from '@mr/shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { intakeOrderDetailFixture, renderDetailUi } from '../../detail/__tests__/render-detail.js'
import { IntakeHandoverScreen } from '../handover-screen.js'

const handOver = vi.fn()
const skipHandover = vi.fn()

vi.mock('@mr/shared', async () => {
  const actual = await vi.importActual<typeof import('@mr/shared')>('@mr/shared')
  return {
    ...actual,
    handOverIntakeOrder: (id: string, input: unknown) => handOver(id, input),
    skipIntakeOrderHandover: (id: string) => skipHandover(id),
  }
})

const ORDER = intakeOrderDetailFixture({ status: IntakeOrderStatus.Done })

/**
 * jsdom reports every box as 0×0 and the pad converts pointer coordinates against its own rect, so
 * the room has to be stated or every point is dropped and nothing can be signed.
 *
 * Three points, because that is what `isSignatureFilled` accepts: one `pointerdown` plus two moves.
 */
function signPad(index: number): void {
  const surface = document.querySelectorAll('svg[viewBox="0 0 460 200"]')[index]
    ?.parentElement as HTMLElement
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 460, height: 200 }) as DOMRect

  fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 })
  fireEvent.pointerMove(surface, { clientX: 40, clientY: 60 })
  fireEvent.pointerMove(surface, { clientX: 90, clientY: 30 })
  fireEvent.pointerUp(surface)
}

const TECHNICIAN_PAD = 0
const OWNER_PAD = 1

const handOverButton = (): HTMLElement =>
  screen.getByRole('button', { name: m.intake_handover_action() })

describe('the handover screen', () => {
  beforeEach(() => {
    handOver.mockReset().mockResolvedValue(ORDER)
    skipHandover.mockReset().mockResolvedValue(ORDER)
  })

  /**
   * The rule the wizard's step 1 was fixed by on 15.08.: a dead button has to name the field that
   * is actually missing. Reciting "both signatures are required" at a serviser who has already
   * collected one is the same screen he stood in front of and could not read.
   */
  it('keeps the vehicle here until both signatures are in, and names the one that is missing', async () => {
    await renderDetailUi(
      <IntakeHandoverScreen order={ORDER} technicianName="Miloš Jovanović" canSkip />,
    )

    expect(handOverButton()).toBeDisabled()
    expect(
      screen.getByText(
        m.intake_hint_required({
          fields: `${m.intake_handover_missing_technician()}, ${m.intake_handover_missing_owner()}`,
        }),
      ),
    ).toBeDefined()

    signPad(TECHNICIAN_PAD)

    expect(handOverButton()).toBeDisabled()
    // One name, not the list: the technician's is in, so his must be gone from the sentence.
    expect(
      screen.getByText(m.intake_hint_required({ fields: m.intake_handover_missing_owner() })),
    ).toBeDefined()

    signPad(OWNER_PAD)

    expect(handOverButton()).toBeEnabled()
    fireEvent.click(handOverButton())

    await waitFor(() => expect(handOver).toHaveBeenCalledTimes(1))
    const [id, input] = handOver.mock.calls[0] as [string, Record<string, string>]
    expect(id).toBe(ORDER.id)
    // The paths are what the sheet prints — an empty one would seal a blank signature box.
    expect(input.technicianSignature.length).toBeGreaterThan(0)
    expect(input.ownerSignature.length).toBeGreaterThan(0)
  })

  it('offers the escape only to whoever may change the status', async () => {
    const { unmount } = await renderDetailUi(
      <IntakeHandoverScreen order={ORDER} technicianName="Miloš Jovanović" canSkip={false} />,
    )

    expect(screen.queryByRole('button', { name: m.intake_handover_skip() })).toBeNull()
    unmount()

    await renderDetailUi(
      <IntakeHandoverScreen order={ORDER} technicianName="Miloš Jovanović" canSkip />,
    )

    expect(screen.queryByRole('button', { name: m.intake_handover_skip() })).not.toBeNull()
  })

  /**
   * Asserts WHICH request fired, not which sentence appeared: a dialog that renders but does not
   * hold the call back protects nothing. And it must say what is being given up — this is the one
   * path that leaves the order permanently without a signed handover record.
   */
  it('releases a vehicle without signatures only through a dialog that names the consequence', async () => {
    await renderDetailUi(
      <IntakeHandoverScreen order={ORDER} technicianName="Miloš Jovanović" canSkip />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.intake_handover_skip() }))

    expect(
      screen.getByText(m.intake_handover_skip_confirm_title({ number: ORDER.orderNumber })),
    ).toBeDefined()
    expect(
      screen.getByText(m.intake_handover_skip_confirm_body({ number: ORDER.orderNumber })),
    ).toBeDefined()
    expect(skipHandover).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getAllByRole('button', { name: m.intake_handover_skip() }).at(-1) as HTMLElement,
    )

    await waitFor(() => expect(skipHandover).toHaveBeenCalledWith(ORDER.id))
    expect(handOver).not.toHaveBeenCalled()
  })
})
