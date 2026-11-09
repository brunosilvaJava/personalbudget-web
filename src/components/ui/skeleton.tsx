import * as React from 'react'

import { cn } from '@/lib/utils'

// shadcn/ui Skeleton (new-york v4), written by hand.
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-accent', className)}
      {...props}
    />
  )
}

export { Skeleton }
