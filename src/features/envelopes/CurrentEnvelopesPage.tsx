import { PiggyBank } from 'lucide-react'
import { Link, Navigate } from 'react-router'

import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentPayCycle } from '@/features/period/queries'

/** "/envelopes": the envelopes of the cycle that contains today. */
export function CurrentEnvelopesPage() {
  const current = useCurrentPayCycle()

  if (current.isPending) return <Skeleton className="h-24 w-full" />
  if (current.isError) {
    return <ErrorState error={current.error} onRetry={() => void current.refetch()} />
  }
  if (current.data) return <Navigate to={`/ciclos/${current.data.code}/envelopes`} replace />
  return (
    <EmptyState
      icon={PiggyBank}
      title="Hoje não cai em nenhum ciclo"
      description="Os envelopes pertencem a um ciclo. Ative os ciclos, ou abra um ciclo da lista para ver os envelopes dele."
      action={
        <Button asChild variant="outline" className="h-11">
          <Link to="/ciclos">Ver os ciclos</Link>
        </Button>
      }
    />
  )
}
