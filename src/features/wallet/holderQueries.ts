import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  CreditCardHolderRequest,
  CreditCardHolderUpdateRequest,
  CreditCardPlasticRequest,
  CreditCardPlasticUpdateRequest,
  UUID,
} from '@/api/contracts'
import {
  createHolder,
  createPlastic,
  listHolders,
  listPlastics,
  setHolderActive,
  updateHolder,
  updatePlastic,
} from '@/api/creditCardHolders'
import { invalidateFinancial, queryKeys } from '@/lib/query-keys'

export function useHolders(cardCode: UUID) {
  return useQuery({
    queryKey: queryKeys.cardHolders(cardCode),
    queryFn: ({ signal }) => listHolders(cardCode, signal),
  })
}

/** `enabled` false while there is no card to ask about (a purchase form with no card chosen yet). */
export function usePlastics(cardCode: UUID | null) {
  return useQuery({
    queryKey: queryKeys.cardPlastics(cardCode ?? ''),
    queryFn: ({ signal }) => listPlastics(cardCode!, signal),
    enabled: cardCode !== null && cardCode !== '',
  })
}

function useHolderMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancial(queryClient) })
}

export function useCreateHolder() {
  return useHolderMutation(
    ({ cardCode, body }: { cardCode: UUID; body: CreditCardHolderRequest }) =>
      createHolder(cardCode, body),
  )
}

export function useUpdateHolder() {
  return useHolderMutation(
    ({
      cardCode,
      holderCode,
      body,
    }: {
      cardCode: UUID
      holderCode: UUID
      body: CreditCardHolderUpdateRequest
    }) => updateHolder(cardCode, holderCode, body),
  )
}

export function useSetHolderActive() {
  return useHolderMutation(
    ({ cardCode, holderCode, active }: { cardCode: UUID; holderCode: UUID; active: boolean }) =>
      setHolderActive(cardCode, holderCode, active),
  )
}

export function useCreatePlastic() {
  return useHolderMutation(
    ({ cardCode, body }: { cardCode: UUID; body: CreditCardPlasticRequest }) =>
      createPlastic(cardCode, body),
  )
}

export function useUpdatePlastic() {
  return useHolderMutation(
    ({
      cardCode,
      plasticCode,
      body,
    }: {
      cardCode: UUID
      plasticCode: UUID
      body: CreditCardPlasticUpdateRequest
    }) => updatePlastic(cardCode, plasticCode, body),
  )
}
