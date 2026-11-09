import { endpoints, toQueryString, type DashboardResponse, type YearMonth } from './contracts'
import { request } from './http'

/** Calendar month, cash based. Without month, the current one. */
export function getDashboard(month?: YearMonth, signal?: AbortSignal): Promise<DashboardResponse> {
  return request(`${endpoints.dashboard}${toQueryString({ month })}`, { signal })
}
