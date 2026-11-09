import {
  endpoints,
  type HolidayCalendarPreviewResponse,
  type HolidayYearRequest,
  type HolidayYearResponse,
} from './contracts'
import { request } from './http'

const base = endpoints.holidayCalendar

/** The reviewed years only. */
export function listHolidayYears(signal?: AbortSignal): Promise<HolidayYearResponse[]> {
  return request(base, { signal })
}

/** `reviewed: false` when the year was never prepared (different from reviewed with no holidays). */
export function getHolidayYear(year: number, signal?: AbortSignal): Promise<HolidayYearResponse> {
  return request(`${base}/${year}`, { signal })
}

/** The COMPLETE list of the year: the holidays left out are removed. Marks the year as reviewed. */
export function saveHolidayYear(
  year: number,
  body: HolidayYearRequest,
): Promise<HolidayYearResponse> {
  return request(`${base}/${year}`, { method: 'PUT', body })
}

/** What saving the list would change in the income dates and in the cycle boundaries. Writes nothing. */
export function previewHolidayYear(
  year: number,
  body: HolidayYearRequest,
): Promise<HolidayCalendarPreviewResponse> {
  return request(`${base}/${year}/preview`, { method: 'POST', body })
}
