import { endpoints, toQueryString, type DailyBalance, type DailyBalanceQuery } from './contracts'
import { request } from './http'

/** One per day, end INCLUSIVE. The API answers a Set: sorted here by date. */
export async function getDailyBalance(
  query: DailyBalanceQuery,
  signal?: AbortSignal,
): Promise<DailyBalance[]> {
  const days = await request<DailyBalance[]>(`${endpoints.dailyBalance}${toQueryString(query)}`, {
    signal,
  })
  return [...days].sort((a, b) => a.date.localeCompare(b.date))
}
