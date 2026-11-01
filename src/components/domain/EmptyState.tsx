import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** suggested action, e.g. a "Lançar" button */
  action?: ReactNode
  className?: string
}

/** Empty list or screen, always with a suggested next step when there is one. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
