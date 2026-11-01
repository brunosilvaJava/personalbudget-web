import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'

import { createQueryClient } from './query-client'
import { router } from './router'
import { useSystemTheme } from './theme'

export function App() {
  const [queryClient] = useState(createQueryClient)
  useSystemTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
