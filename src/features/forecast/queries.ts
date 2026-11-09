import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ISODate } from '@/api/contracts'
import { getCashForecast } from '@/api/forecast'
import { queryKeys } from '@/lib/query-keys'

/**
 * The cash forecast. `until` null lets the back choose the horizon (end of the current cycle, or
 * of the month). While another horizon loads, the previous numbers stay on screen.
 */
export function useCashForecast(until: ISODate | null, includeLateIncome: boolean) {
  return useQuery({
    queryKey: queryKeys.forecast(until, includeLateIncome),
    queryFn: ({ signal }) =>
      getCashForecast(
        {
          ...(until ? { until } : {}),
          ...(includeLateIncome ? { include_late_income: true } : {}),
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  })
}
