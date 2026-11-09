import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import type {
  CardInvoicePaymentRequest,
  CardPurchaseRequest,
  CardPurchaseUpdateRequest,
  CreditCardRequest,
  CreditCardResponse,
  CreditCardStatus,
  CreditCardUpdateRequest,
  UUID,
} from '@/api/contracts'
import {
  createCard,
  createPurchase,
  deletePurchase,
  getCard,
  getCardLimit,
  getInvoice,
  getPurchase,
  listCardInvoices,
  listCards,
  listInvoicePayments,
  payInvoice,
  reverseInvoicePayment,
  setCardActive,
  updateCard,
  updatePurchase,
} from '@/api/creditCards'
import { invalidateFinancial, queryKeys } from '@/lib/query-keys'

const ALL: readonly CreditCardStatus[] = ['ACTIVE', 'INACTIVE']
const ACTIVE: readonly CreditCardStatus[] = ['ACTIVE']

export function useAllCards() {
  return useQuery({
    queryKey: queryKeys.creditCards(ALL),
    queryFn: ({ signal }) => listCards({ status: [...ALL] }, signal),
  })
}

export function useActiveCards() {
  return useQuery({
    queryKey: queryKeys.creditCards(ACTIVE),
    queryFn: ({ signal }) => listCards({}, signal),
  })
}

export function useCardLookup(): Map<UUID, CreditCardResponse> {
  const { data } = useAllCards()
  return useMemo(() => new Map((data ?? []).map((card) => [card.code, card])), [data])
}

export function useCard(code: UUID) {
  return useQuery({
    queryKey: queryKeys.creditCard(code),
    queryFn: ({ signal }) => getCard(code, signal),
  })
}

export function useCardLimit(code: UUID) {
  return useQuery({
    queryKey: queryKeys.cardLimit(code),
    queryFn: ({ signal }) => getCardLimit(code, signal),
  })
}

export function useCardInvoices(cardCode: UUID) {
  return useQuery({
    queryKey: queryKeys.cardInvoices(cardCode),
    queryFn: ({ signal }) => listCardInvoices(cardCode, {}, signal),
  })
}

export function useInvoice(code: UUID) {
  return useQuery({
    queryKey: queryKeys.cardInvoice(code),
    queryFn: ({ signal }) => getInvoice(code, signal),
  })
}

export function useInvoicePayments(code: UUID) {
  return useQuery({
    queryKey: queryKeys.invoicePayments(code),
    queryFn: ({ signal }) => listInvoicePayments(code, signal),
  })
}

export function usePurchase(code: UUID | null) {
  return useQuery({
    queryKey: queryKeys.cardPurchase(code ?? ''),
    queryFn: ({ signal }) => getPurchase(code!, signal),
    enabled: code !== null,
  })
}

function useFinancialMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancial(queryClient) })
}

export function useCreateCard() {
  return useFinancialMutation((body: CreditCardRequest) => createCard(body))
}

export function useUpdateCard() {
  return useFinancialMutation(({ code, body }: { code: UUID; body: CreditCardUpdateRequest }) =>
    updateCard(code, body),
  )
}

export function useSetCardActive() {
  return useFinancialMutation(({ code, active }: { code: UUID; active: boolean }) =>
    setCardActive(code, active),
  )
}

export function useCreatePurchase() {
  return useFinancialMutation((body: CardPurchaseRequest) => createPurchase(body))
}

export function useUpdatePurchase() {
  return useFinancialMutation(({ code, body }: { code: UUID; body: CardPurchaseUpdateRequest }) =>
    updatePurchase(code, body),
  )
}

export function useDeletePurchase() {
  return useFinancialMutation((code: UUID) => deletePurchase(code))
}

export function usePayInvoice() {
  return useFinancialMutation(({ code, body }: { code: UUID; body: CardInvoicePaymentRequest }) =>
    payInvoice(code, body),
  )
}

export function useReverseInvoicePayment() {
  return useFinancialMutation(
    ({ invoiceCode, paymentCode }: { invoiceCode: UUID; paymentCode: UUID }) =>
      reverseInvoicePayment(invoiceCode, paymentCode),
  )
}
