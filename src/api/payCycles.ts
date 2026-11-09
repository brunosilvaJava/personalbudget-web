import {
  endpoints,
  toQueryString,
  type ISODate,
  type PayCycleResponse,
  type UUID,
} from './contracts'
import { ApiError, request } from './http'

const base = endpoints.payCycle

/**
 * The cycle that contains today, or null when there is none: the cycles are off
 * (CALENDAR_MONTH) or today is not covered. The 404 body (PayCycleCurrentNotFoundResponse) says
 * why; the screens only need to fall back to the calendar month.
 */
export async function getCurrentPayCycle(signal?: AbortSignal): Promise<PayCycleResponse | null> {
  try {
    return await request<PayCycleResponse>(`${base}/current`, { signal })
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null
    throw error
  }
}

/** The cycle that contains `date`, or null. */
export async function getPayCycleByDate(
  date: ISODate,
  signal?: AbortSignal,
): Promise<PayCycleResponse | null> {
  const cycles = await request<PayCycleResponse[]>(`${base}${toQueryString({ date })}`, { signal })
  return cycles[0] ?? null
}

export function getPayCycle(code: UUID, signal?: AbortSignal): Promise<PayCycleResponse> {
  return request(`${base}/${code}`, { signal })
}
