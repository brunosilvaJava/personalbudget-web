import { useInfiniteQuery } from '@tanstack/react-query'

import { listMovements } from '@/api/financialMovements'
import { queryKeys, type MovementListFilters } from '@/lib/query-keys'

/** The list loads 20 at a time while scrolling. */
export const MOVEMENTS_PAGE_SIZE = 20

export function useMovementList(filters: MovementListFilters | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.movements(filters ?? { start_date: '', end_date: '' }),
    queryFn: ({ pageParam, signal }) =>
      listMovements({ ...filters!, page: pageParam, size: MOVEMENTS_PAGE_SIZE }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.page + 1),
    enabled: filters !== undefined,
  })
}
