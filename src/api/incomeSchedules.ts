import {
  endpoints,
  toQueryString,
  type IncomeOccurrenceQuery,
  type IncomeOccurrenceResponse,
  type IncomeScheduleQuery,
  type IncomeScheduleRequest,
  type IncomeScheduleResponse,
  type IncomeScheduleUpdateRequest,
  type UUID,
  type YearMonth,
} from './contracts'
import { request } from './http'

const base = endpoints.incomeSchedule

/** A plain array. Without `status`, only ACTIVE. */
export function listIncomeSchedules(
  query: IncomeScheduleQuery = {},
  signal?: AbortSignal,
): Promise<IncomeScheduleResponse[]> {
  return request(`${base}${toQueryString(query)}`, { signal })
}

export function getIncomeSchedule(
  code: UUID,
  signal?: AbortSignal,
): Promise<IncomeScheduleResponse> {
  return request(`${base}/${code}`, { signal })
}

export function createIncomeSchedule(body: IncomeScheduleRequest): Promise<IncomeScheduleResponse> {
  return request(base, { method: 'POST', body })
}

export function updateIncomeSchedule(
  code: UUID,
  body: IncomeScheduleUpdateRequest,
): Promise<IncomeScheduleResponse> {
  return request(`${base}/${code}`, { method: 'PATCH', body })
}

export function setIncomeScheduleActive(
  code: UUID,
  active: boolean,
): Promise<IncomeScheduleResponse> {
  return request(`${base}/${code}/${active ? 'activate' : 'inactivate'}`, { method: 'PATCH' })
}

/** One entry per nominal month, from `from` to `to` (default: this month and the next 11; at most 36). */
export function listIncomeOccurrences(
  code: UUID,
  query: IncomeOccurrenceQuery = {},
  signal?: AbortSignal,
): Promise<IncomeOccurrenceResponse[]> {
  return request(`${base}/${code}/occurrence${toQueryString(query)}`, { signal })
}

/**
 * Generates the CREDIT movement of a month ahead of the job (up to the current month + 1). The
 * date and the amount freeze. Answers 201 when it created it and 200 when it already existed.
 */
export function materializeIncomeOccurrence(
  code: UUID,
  month: YearMonth,
): Promise<IncomeOccurrenceResponse> {
  return request(`${base}/${code}/occurrence/${month}/materialize`, { method: 'POST' })
}
