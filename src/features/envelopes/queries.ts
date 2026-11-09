import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createEnvelope, deleteEnvelope, listCycleEnvelopes, updateEnvelope } from '@/api/envelopes'
import type {
  BudgetEnvelopeRequest,
  BudgetEnvelopeResponse,
  BudgetEnvelopeUpdateRequest,
  UUID,
} from '@/api/contracts'
import { errorMessage } from '@/lib/api-errors'
import { invalidateFinancial, queryKeys } from '@/lib/query-keys'

/** The envelopes of a cycle with what was consumed; the numbers come from the cycle report. */
export function useCycleEnvelopes(cycleCode: UUID) {
  return useQuery({
    queryKey: queryKeys.envelopes(cycleCode),
    queryFn: ({ signal }) => listCycleEnvelopes(cycleCode, signal),
  })
}

/**
 * An envelope write changes the envelopes, the cycle report and the forecast reserve: the whole
 * financial group is refreshed. The toast lives here, not in the sheet or the row that asked: the
 * refreshed list can take that sheet or row off the screen before the answer is handled, and a
 * callback given to `mutate` does not run once its component is gone.
 */
export function useCreateEnvelope() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cycleCode, body }: { cycleCode: UUID; body: BudgetEnvelopeRequest }) =>
      createEnvelope(cycleCode, body),
    onSuccess: async (created: BudgetEnvelopeResponse) => {
      toast.success(`Envelope de ${created.category_name} criado.`)
      await invalidateFinancial(queryClient)
    },
  })
}

export function useUpdateEnvelope() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, body }: { code: UUID; body: BudgetEnvelopeUpdateRequest }) =>
      updateEnvelope(code, body),
    onSuccess: async (updated: BudgetEnvelopeResponse) => {
      toast.success(`Envelope de ${updated.category_name} atualizado.`)
      await invalidateFinancial(queryClient)
    },
  })
}

export function useDeleteEnvelope() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: UUID) => deleteEnvelope(code),
    onSuccess: async () => {
      toast.success('Envelope excluído.')
      await invalidateFinancial(queryClient)
    },
    // The confirmation is a dialog with no place for the message (a closed cycle answers 409).
    onError: (error) => toast.error(errorMessage(error)),
  })
}
