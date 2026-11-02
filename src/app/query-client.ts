import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/api/http'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // A 4xx will not change by retrying; a network blip or a 5xx might.
        retry: (failureCount, error) =>
          failureCount < 1 &&
          !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
      mutations: {
        // No optimistic updates in the MVP: every write waits for the answer.
        retry: false,
      },
    },
  })
}
