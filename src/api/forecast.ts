import {
  endpoints,
  toQueryString,
  type CashForecastQuery,
  type CashForecastResponse,
} from './contracts'
import { request } from './http'

/**
 * Read only. Without `until` the back uses the last day of the current cycle, or of the month.
 * 400 when `until` is before today or more than 366 days ahead.
 */
export function getCashForecast(
  query: CashForecastQuery = {},
  signal?: AbortSignal,
): Promise<CashForecastResponse> {
  return request(`${endpoints.forecast}${toQueryString(query)}`, { signal })
}
