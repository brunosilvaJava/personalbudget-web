import {
  endpoints,
  toQueryString,
  type ReceiptRequest,
  type ReceivableResponse,
  type ReceivableUpdateRequest,
  type ReceivableWriteOffRequest,
  type ThirdPartyQuery,
  type ThirdPartyRequest,
  type ThirdPartyResponse,
  type ThirdPartyUpdateRequest,
  type UUID,
} from './contracts'
import { request } from './http'

const thirdParties = endpoints.thirdParty

/** A plain array. Without `status`, only ACTIVE. */
export function listThirdParties(
  query: ThirdPartyQuery = {},
  signal?: AbortSignal,
): Promise<ThirdPartyResponse[]> {
  return request(`${thirdParties}${toQueryString(query)}`, { signal })
}

export function getThirdParty(code: UUID, signal?: AbortSignal): Promise<ThirdPartyResponse> {
  return request(`${thirdParties}/${code}`, { signal })
}

export function createThirdParty(body: ThirdPartyRequest): Promise<ThirdPartyResponse> {
  return request(thirdParties, { method: 'POST', body })
}

export function updateThirdParty(
  code: UUID,
  body: ThirdPartyUpdateRequest,
): Promise<ThirdPartyResponse> {
  return request(`${thirdParties}/${code}`, { method: 'PATCH', body })
}

/** Inactivating answers 409 while something is left to receive. */
export function setThirdPartyActive(code: UUID, active: boolean): Promise<ThirdPartyResponse> {
  return request(`${thirdParties}/${code}/${active ? 'activate' : 'inactivate'}`, {
    method: 'PATCH',
  })
}

/** Oldest due date first. */
export function listReceivables(
  thirdPartyCode: UUID,
  signal?: AbortSignal,
): Promise<ReceivableResponse[]> {
  return request(`${thirdParties}/${thirdPartyCode}/receivables`, { signal })
}

export function updateReceivableDueDate(
  thirdPartyCode: UUID,
  receivableCode: UUID,
  body: ReceivableUpdateRequest,
): Promise<ReceivableResponse> {
  return request(`${thirdParties}/${thirdPartyCode}/receivables/${receivableCode}`, {
    method: 'PATCH',
    body,
  })
}

/** Spreads the amount from the oldest receivable to the newest; answers the ones touched. */
export function receive(thirdPartyCode: UUID, body: ReceiptRequest): Promise<ReceivableResponse[]> {
  return request(`${thirdParties}/${thirdPartyCode}/receipts`, { method: 'POST', body })
}

/** Gives up on the whole open balance: it becomes an own expense. No cash moves. */
export function writeOffReceivable(
  thirdPartyCode: UUID,
  receivableCode: UUID,
  body: ReceivableWriteOffRequest,
): Promise<ReceivableResponse> {
  return request(`${thirdParties}/${thirdPartyCode}/receivables/${receivableCode}/write_off`, {
    method: 'POST',
    body,
  })
}
