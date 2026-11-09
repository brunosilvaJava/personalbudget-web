import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'

import { UpdatePrompt } from '@/components/layout/UpdatePrompt'
import { Toaster } from '@/components/ui/sonner'
import { createQueryClient } from './query-client'
import { router } from './router'
import { useAppTheme } from './theme'

export function App() {
  const [queryClient] = useState(createQueryClient)
  useAppTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <UpdatePrompt />
    </QueryClientProvider>
  )
}
