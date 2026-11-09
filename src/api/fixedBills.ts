import {
  endpoints,
  toQueryString,
  type FixedBillQuery,
  type FixedBillRequest,
  type FixedBillResponse,
  type FixedBillUpdateRequest,
  type Page,
  type UUID,
} from './contracts'
import { request } from './http'

const base = endpoints.fixedBill

export function listFixedBills(
  query: FixedBillQuery,
  signal?: AbortSignal,
): Promise<Page<FixedBillResponse>> {
  return request(`${base}${toQueryString(query)}`, { signal })
}

/** Saving can post today's occurrence on the server (PR #62): next_due_date then moves ahead. */
export function createFixedBill(body: FixedBillRequest): Promise<FixedBillResponse> {
  return request(base, { method: 'POST', body })
}

/** `description` is required by the back even when unchanged. */
export function updateFixedBill(
  code: UUID,
  body: FixedBillUpdateRequest,
): Promise<FixedBillResponse> {
  return request(`${base}/${code}`, { method: 'PATCH', body })
}

export function setFixedBillActive(code: UUID, active: boolean): Promise<FixedBillResponse> {
  return request(`${base}/${code}/${active ? 'activate' : 'inactivate'}`, { method: 'PATCH' })
}

export function deleteFixedBill(code: UUID): Promise<void> {
  return request(`${base}/${code}`, { method: 'DELETE' })
}
