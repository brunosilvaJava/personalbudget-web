import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ReceiptRequest, ReceivableUpdateRequest, UUID } from '@/api/contracts'
import {
  getThirdParty,
  listReceivables,
  receive,
  updateReceivableDueDate,
} from '@/api/thirdParties'
import { invalidateFinancial, queryKeys } from '@/lib/query-keys'

export function useThirdParty(code: UUID) {
  return useQuery({
    queryKey: queryKeys.thirdParty(code),
    queryFn: ({ signal }) => getThirdParty(code, signal),
  })
}

/** Oldest due date first, every status: the ones already settled are history. */
export function useReceivables(thirdPartyCode: UUID) {
  return useQuery({
    queryKey: queryKeys.receivables(thirdPartyCode),
    queryFn: ({ signal }) => listReceivables(thirdPartyCode, signal),
  })
}

function useReceivableMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancial(queryClient) })
}

export function useReceive() {
  return useReceivableMutation(
    ({ thirdPartyCode, body }: { thirdPartyCode: UUID; body: ReceiptRequest }) =>
      receive(thirdPartyCode, body),
  )
}

export function useUpdateReceivableDueDate() {
  return useReceivableMutation(
    ({
      thirdPartyCode,
      receivableCode,
      body,
    }: {
      thirdPartyCode: UUID
      receivableCode: UUID
      body: ReceivableUpdateRequest
    }) => updateReceivableDueDate(thirdPartyCode, receivableCode, body),
  )
}
