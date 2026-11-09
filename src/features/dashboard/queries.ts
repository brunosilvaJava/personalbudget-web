import { useQuery } from '@tanstack/react-query'

import type { YearMonth } from '@/api/contracts'
import { getDashboard } from '@/api/dashboard'
import { queryKeys } from '@/lib/query-keys'

export function useDashboard(month: YearMonth) {
  return useQuery({
    queryKey: queryKeys.dashboard(month),
    queryFn: ({ signal }) => getDashboard(month, signal),
  })
}
