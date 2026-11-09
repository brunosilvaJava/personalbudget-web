import { CircleAlert, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-errors'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  title?: string
  className?: string
}

/** A list or a screen that could not load, with "Tentar de novo". */
export function ErrorState({
  error,
  onRetry,
  retrying,
  title = 'Não foi possível carregar',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border px-6 py-10 text-center',
        className,
      )}
    >
      <CircleAlert className="size-8 text-warning" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" className="h-11" onClick={onRetry} disabled={retrying}>
          <RotateCw className={retrying ? 'animate-spin' : undefined} aria-hidden />
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
