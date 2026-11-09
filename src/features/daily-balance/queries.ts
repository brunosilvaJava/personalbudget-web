import { useQuery } from '@tanstack/react-query'

import { getDailyBalance } from '@/api/balance'
import type { ISODate } from '@/api/contracts'
import { queryKeys } from '@/lib/query-keys'

export function useDailyBalance(start: ISODate | undefined, end: ISODate | undefined) {
  return useQuery({
    queryKey: queryKeys.balance(start ?? '', end ?? ''),
    queryFn: ({ signal }) => getDailyBalance({ initial_date: start!, end_date: end! }, signal),
    enabled: Boolean(start && end),
  })
}
