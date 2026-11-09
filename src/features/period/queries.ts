import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { PayCycleResponse, UUID } from '@/api/contracts'
import { getCurrentPayCycle, getPayCycle, getPayCycleByDate } from '@/api/payCycles'
import { monthOf, shiftDate, shiftMonth } from '@/lib/dates'
import { queryKeys } from '@/lib/query-keys'
import {
  cyclePeriod,
  defaultPeriod,
  monthPeriod,
  periodKind,
  shiftCustomPeriod,
  type Period,
} from './period'

const CYCLE_STALE_TIME = 5 * 60_000

/** The cycle that contains today, or null (cycles off or today not covered). */
export function useCurrentPayCycle() {
  return useQuery({
    queryKey: queryKeys.currentPayCycle,
    queryFn: ({ signal }) => getCurrentPayCycle(signal),
    staleTime: CYCLE_STALE_TIME,
  })
}

/**
 * The default period of the movements list and of the daily balance (the same rule on both):
 * the current cycle when there is one, otherwise the current month. If the cycle cannot be read
 * (API down), the month: the screen will show the list's own error anyway.
 */
export function useDefaultPeriod(): { period: Period | undefined; cycle: PayCycleResponse | null } {
  const { data, isPending, isError } = useCurrentPayCycle()
  if (isPending) return { period: undefined, cycle: null }
  if (isError) return { period: defaultPeriod(null), cycle: null }
  return { period: defaultPeriod(data), cycle: data }
}

/** A cycle by code, for its label ("Nov/Dez"). */
export function usePayCycle(code: UUID | undefined) {
  return useQuery({
    queryKey: queryKeys.payCycle(code ?? ''),
    queryFn: ({ signal }) => getPayCycle(code!, signal),
    enabled: Boolean(code),
    staleTime: CYCLE_STALE_TIME,
  })
}

/**
 * The previous or next period of the same kind: cycle → the cycle around the day before the start
 * (or after the end), falling back to that day's month when there is no cycle there; month → the
 * month; custom → the same number of days.
 */
export function useShiftPeriod() {
  const queryClient = useQueryClient()
  return useCallback(
    async (period: Period, direction: -1 | 1): Promise<Period> => {
      const kind = periodKind(period)
      if (kind === 'month') return monthPeriod(shiftMonth(monthOf(period.start), direction))
      if (kind === 'custom') return shiftCustomPeriod(period, direction)

      const date = direction < 0 ? shiftDate(period.start, -1) : shiftDate(period.end, 1)
      const cycle = await queryClient.fetchQuery({
        queryKey: queryKeys.payCycleByDate(date),
        queryFn: ({ signal }) => getPayCycleByDate(date, signal),
        staleTime: CYCLE_STALE_TIME,
      })
      if (cycle) {
        queryClient.setQueryData(queryKeys.payCycle(cycle.code), cycle)
        return cyclePeriod(cycle)
      }
      return monthPeriod(monthOf(date))
    },
    [queryClient],
  )
}
