import { m } from '@mr/i18n'
import { intakeOrderKeys, setIntakeOrderArchived } from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'

import { showInternalToast } from '~/lib/internal-toast'

/**
 * Takes a signed order out of the working list, or puts it back. Nothing is deleted, so unlike a
 * discard the order's own query is invalidated rather than dropped — the detail screen stays
 * openable, which is how it gets brought back and how its history stays reachable.
 */
export function useArchiveIntakeOrder(
  onDone: () => void,
): UseMutationResult<void, Error, { id: string; archived: boolean }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setIntakeOrderArchived(id, archived),
    onSuccess: async (_result, { id, archived }) => {
      showInternalToast(archived ? m.intake_archive_success() : m.intake_unarchive_success())
      onDone()
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.detail(id) })
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.summary() })
    },
    onError: () => showInternalToast(m.intake_archive_failed()),
  })
}
