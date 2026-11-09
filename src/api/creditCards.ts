import {
  endpoints,
  toQueryString,
  type CardInvoicePaymentRequest,
  type CardInvoicePaymentResponse,
  type CardInvoiceQuery,
  type CardInvoiceResponse,
  type CardInvoiceSummaryResponse,
  type CardPurchaseQuery,
  type CardPurchaseRequest,
  type CardPurchaseResponse,
  type CardPurchaseUpdateRequest,
  type CreditCardLimitResponse,
  type CreditCardQuery,
  type CreditCardRequest,
  type CreditCardResponse,
  type CreditCardUpdateRequest,
  type UUID,
} from './contracts'
import { request } from './http'

const cards = endpoints.creditCard
const purchases = endpoints.cardPurchase
const invoices = endpoints.cardInvoice

/** A plain array. Without `status`, only ACTIVE. */
export function listCards(
  query: CreditCardQuery = {},
  signal?: AbortSignal,
): Promise<CreditCardResponse[]> {
  return request(`${cards}${toQueryString(query)}`, { signal })
}

export function getCard(code: UUID, signal?: AbortSignal): Promise<CreditCardResponse> {
  return request(`${cards}/${code}`, { signal })
}

export function createCard(body: CreditCardRequest): Promise<CreditCardResponse> {
  return request(cards, { method: 'POST', body })
}

export function updateCard(code: UUID, body: CreditCardUpdateRequest): Promise<CreditCardResponse> {
  return request(`${cards}/${code}`, { method: 'PATCH', body })
}

export function setCardActive(code: UUID, active: boolean): Promise<CreditCardResponse> {
  return request(`${cards}/${code}/${active ? 'activate' : 'inactivate'}`, { method: 'PATCH' })
}

export function getCardLimit(code: UUID, signal?: AbortSignal): Promise<CreditCardLimitResponse> {
  return request(`${cards}/${code}/limit`, { signal })
}

/** Newest first. */
export function listCardInvoices(
  cardCode: UUID,
  query: CardInvoiceQuery = {},
  signal?: AbortSignal,
): Promise<CardInvoiceSummaryResponse[]> {
  return request(`${cards}/${cardCode}/invoice${toQueryString(query)}`, { signal })
}

export function getInvoice(code: UUID, signal?: AbortSignal): Promise<CardInvoiceResponse> {
  return request(`${invoices}/${code}`, { signal })
}

/** Pays what is still owed on the WHOLE invoice, on one account and one date. */
export function payInvoice(
  code: UUID,
  body: CardInvoicePaymentRequest,
): Promise<CardInvoicePaymentResponse> {
  return request(`${invoices}/${code}/payment`, { method: 'POST', body })
}

/** Newest first, reversed ones included. */
export function listInvoicePayments(
  code: UUID,
  signal?: AbortSignal,
): Promise<CardInvoicePaymentResponse[]> {
  return request(`${invoices}/${code}/payment`, { signal })
}

export function reverseInvoicePayment(
  invoiceCode: UUID,
  paymentCode: UUID,
): Promise<CardInvoicePaymentResponse> {
  return request(`${invoices}/${invoiceCode}/payment/${paymentCode}/reversal`, { method: 'POST' })
}

export function listPurchases(
  query: CardPurchaseQuery,
  signal?: AbortSignal,
): Promise<CardPurchaseResponse[]> {
  return request(`${purchases}${toQueryString(query)}`, { signal })
}

export function getPurchase(code: UUID, signal?: AbortSignal): Promise<CardPurchaseResponse> {
  return request(`${purchases}/${code}`, { signal })
}

export function createPurchase(body: CardPurchaseRequest): Promise<CardPurchaseResponse> {
  return request(purchases, { method: 'POST', body })
}

export function updatePurchase(
  code: UUID,
  body: CardPurchaseUpdateRequest,
): Promise<CardPurchaseResponse> {
  return request(`${purchases}/${code}`, { method: 'PATCH', body })
}

export function deletePurchase(code: UUID): Promise<void> {
  return request(`${purchases}/${code}`, { method: 'DELETE' })
}
