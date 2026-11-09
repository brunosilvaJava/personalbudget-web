import {
  endpoints,
  toQueryString,
  type AccountBalanceResponse,
  type AccountQuery,
  type AccountRequest,
  type AccountResponse,
  type AccountsBalanceResponse,
  type AccountStatementQuery,
  type AccountStatementResponse,
  type AccountTransferQuery,
  type AccountTransferRequest,
  type AccountTransferResponse,
  type AccountUpdateRequest,
  type ISODate,
  type UUID,
} from './contracts'
import { request } from './http'

const base = endpoints.account
const transfers = endpoints.accountTransfer

/** A plain array, the default account first. Without `status`, only ACTIVE. */
export function listAccounts(
  query: AccountQuery = {},
  signal?: AbortSignal,
): Promise<AccountResponse[]> {
  return request(`${base}${toQueryString(query)}`, { signal })
}

export function getAccount(code: UUID, signal?: AbortSignal): Promise<AccountResponse> {
  return request(`${base}/${code}`, { signal })
}

export function createAccount(body: AccountRequest): Promise<AccountResponse> {
  return request(base, { method: 'POST', body })
}

export function updateAccount(code: UUID, body: AccountUpdateRequest): Promise<AccountResponse> {
  return request(`${base}/${code}`, { method: 'PATCH', body })
}

export function inactivateAccount(code: UUID): Promise<AccountResponse> {
  return request(`${base}/${code}/inactivate`, { method: 'PATCH' })
}

export function activateAccount(code: UUID): Promise<AccountResponse> {
  return request(`${base}/${code}/activate`, { method: 'PATCH' })
}

/** Every account (ACTIVE and INACTIVE) and the total, on `date` (today when omitted). */
export function getAccountBalances(
  date?: ISODate,
  signal?: AbortSignal,
): Promise<AccountsBalanceResponse> {
  return request(`${base}/balance${toQueryString({ date })}`, { signal })
}

export function getAccountBalance(
  code: UUID,
  date?: ISODate,
  signal?: AbortSignal,
): Promise<AccountBalanceResponse> {
  return request(`${base}/${code}/balance${toQueryString({ date })}`, { signal })
}

export function getAccountStatement(
  code: UUID,
  query: AccountStatementQuery,
  signal?: AbortSignal,
): Promise<AccountStatementResponse> {
  return request(`${base}/${code}/statement${toQueryString(query)}`, { signal })
}

/** Reversed ones included. A plain array, newest first. */
export function listTransfers(
  query: AccountTransferQuery,
  signal?: AbortSignal,
): Promise<AccountTransferResponse[]> {
  return request(`${transfers}${toQueryString(query)}`, { signal })
}

export function createTransfer(body: AccountTransferRequest): Promise<AccountTransferResponse> {
  return request(transfers, { method: 'POST', body })
}

export function reverseTransfer(code: UUID): Promise<AccountTransferResponse> {
  return request(`${transfers}/${code}/reversal`, { method: 'POST' })
}
