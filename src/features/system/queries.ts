import { useQuery } from '@tanstack/react-query'

import { getHealth } from '@/api/health'
import { queryKeys } from '@/lib/query-keys'

/** Is the API reachable through the /api proxy? */
export function useApiHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => getHealth(signal),
    retry: false,
    staleTime: 0,
  })
}
