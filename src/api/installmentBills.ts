import {
  endpoints,
  toQueryString,
  type InstallmentBillQuery,
  type InstallmentBillRequest,
  type InstallmentBillResponse,
  type InstallmentBillUpdateRequest,
  type Page,
  type UUID,
} from './contracts'
import { request } from './http'

const base = endpoints.installmentBill

export function listInstallmentBills(
  query: InstallmentBillQuery,
  signal?: AbortSignal,
): Promise<Page<InstallmentBillResponse>> {
  return request(`${base}${toQueryString(query)}`, { signal })
}

/** A purchase date 30+ days ago posts the installments already due on save. */
export function createInstallmentBill(
  body: InstallmentBillRequest,
): Promise<InstallmentBillResponse> {
  return request(base, { method: 'POST', body })
}

/** `description` is required by the back even when unchanged. */
export function updateInstallmentBill(
  code: UUID,
  body: InstallmentBillUpdateRequest,
): Promise<InstallmentBillResponse> {
  return request(`${base}/${code}`, { method: 'PATCH', body })
}

export function deleteInstallmentBill(code: UUID): Promise<void> {
  return request(`${base}/${code}`, { method: 'DELETE' })
}
