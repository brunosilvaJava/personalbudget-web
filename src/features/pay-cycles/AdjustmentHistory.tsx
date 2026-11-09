import type { UUID } from '@/api/contracts'
import { ErrorState } from '@/components/domain/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { usePayCycleAdjustments } from './queries'
import { ADJUSTMENT_TYPE_LABEL, describeAdjustment } from './rules'

/** What changed this cycle, newest first: the boundary, the reason and the day. */
export function AdjustmentHistory({ code }: { code: UUID }) {
  const history = usePayCycleAdjustments(code)

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-2">
      <h2 id="history-title" className="font-medium">
        Histórico de ajustes
      </h2>
      {history.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : history.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ajuste neste ciclo.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {history.data.map((entry) => (
            <li key={entry.code} className="flex flex-col gap-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ADJUSTMENT_TYPE_LABEL[entry.type]}</Badge>
                <span className="text-muted-foreground">{formatDate(entry.created_date)}</span>
              </div>
              {describeAdjustment(entry) && <p>{describeAdjustment(entry)}</p>}
              {entry.justification && (
                <p className="text-muted-foreground">“{entry.justification}”</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
