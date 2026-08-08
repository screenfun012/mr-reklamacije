import { m } from '@mr/i18n'
import { intakeOrderKeys, updateIntakeOrder, type IntakeOrderDetail } from '@mr/shared'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { showInternalToast } from '~/lib/internal-toast'

/**
 * One list at a time — the card that changed sends its own array and nothing else. A union rather
 * than a `Pick` of the update input: with both keys merely optional, the optimistic spread widens
 * the detail's `services` to `string[] | undefined` and would write `undefined` over a list.
 */
export type IntakeSpecEdit = { services: string[] } | { materials: string[] }

export function useUpdateIntakeSpec(
  id: string,
): UseMutationResult<IntakeOrderDetail, Error, IntakeSpecEdit> {
  const queryClient = useQueryClient()
  const detailKey = intakeOrderKeys.detail(id)

  return useMutation<
    IntakeOrderDetail,
    Error,
    IntakeSpecEdit,
    { previous: IntakeOrderDetail | undefined }
  >({
    mutationFn: (input) => updateIntakeOrder(id, input),
    onMutate: async (input) => {
      // Cancelling first is load-bearing: for an operator his own SSE event invalidates
      // `['intake-orders']` while he types, and an in-flight refetch landing after the optimistic
      // write would drop the line he just added back off the screen.
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<IntakeOrderDetail>(detailKey)
      if (previous !== undefined) {
        queryClient.setQueryData<IntakeOrderDetail>(detailKey, { ...previous, ...input })
      }
      return { previous }
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(detailKey, updated)
      // The PATCH writes a `spec_updated` audit row. SSE never reaches a serviser —
      // `resource_changed` publishes to the operator/viewer/admin channels only — so without this
      // the Istorija tab would keep showing a history that is missing his own edit.
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.history(id) })
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(detailKey, context.previous)
      }
      showInternalToast(m.intake_detail_action_failed())
    },
  })
}
