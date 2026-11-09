import { SearchX } from 'lucide-react'

import { isNotFound } from '@/lib/api-errors'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

/** A record that could not load: a 404 is "it no longer exists", anything else can be retried. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (isNotFound(error)) {
    return (
      <EmptyState
        icon={SearchX}
        title="Este registro não existe mais"
        description="Ele pode ter sido excluído em outro aparelho."
      />
    )
  }
  return <ErrorState error={error} onRetry={onRetry} />
}
