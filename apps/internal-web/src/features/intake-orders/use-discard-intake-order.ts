import { m } from '@mr/i18n'
import { deleteIntakeOrder, intakeOrderKeys } from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'

import { showInternalToast } from '~/lib/internal-toast'

/**
 * Discarding an unfinished intake — from the draft's own screen or from the list. The server
 * decides who may: his own draft goes with `intake_orders.update`, a colleague's additionally
 * needs `intake_orders.delete`, and a SIGNED order is refused to everyone, because it is the
 * firm's half of the paper the owner signed.
 *
 * `onDone` is what the caller does next — leave the screen, or close a dialog.
 */
export function useDiscardIntakeOrder(
  onDone: (id: string) => void | Promise<void>,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteIntakeOrder(id),
    onSuccess: async (_result, id) => {
      // Drop this order's own query rather than invalidating it. A discard is a HARD delete, so
      // invalidating would refetch the row we just removed, get a 404, retry it three times with
      // backoff — and hold the serviser on a red "Nalog nije pronađen" over a discard that worked.
      queryClient.removeQueries({ queryKey: intakeOrderKeys.detail(id) })
      await onDone(id)
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.summary() })
    },
    onError: () => showInternalToast(m.intake_discard_failed()),
  })
}
