import type { PayCycleResponse, PayCycleSnapshotResponse } from '@/api/contracts'
import { ErrorState } from '@/components/domain/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { describeClosedAt, newestSnapshotsFirst, snapshotAsSummary } from './closure'
import { CycleSummaryView } from './CycleSummaryView'
import { useCycleSnapshots } from './queries'

/**
 * What each closure froze, newest first. While the cycle is CLOSED the newest is the one in force
 * and shows open; the older ones (and all of them once the cycle was reopened) fold, because they
 * only matter when someone compares.
 */
export function SnapshotHistory({ cycle }: { cycle: PayCycleResponse }) {
  const snapshots = useCycleSnapshots(cycle.code)
  const closed = cycle.status === 'CLOSED'

  if (snapshots.isPending) return <Skeleton className="h-24 w-full" />
  if (snapshots.isError) {
    return <ErrorState error={snapshots.error} onRetry={() => void snapshots.refetch()} />
  }
  if (snapshots.data.length === 0) {
    return closed ? (
      <p className="text-sm text-muted-foreground">Nenhum registro de fechamento encontrado.</p>
    ) : null
  }

  const sorted = newestSnapshotsFirst(snapshots.data)
  return (
    <section aria-labelledby="snapshots-title" className="flex flex-col gap-3">
      <h3 id="snapshots-title" className="font-medium">
        {closed ? 'Fechamentos' : 'Fechamentos anteriores'}
      </h3>
      <ul className="flex flex-col gap-3">
        {sorted.map((snapshot, index) => (
          <li key={snapshot.code} className="rounded-lg border bg-card p-4">
            {closed && index === 0 ? (
              <>
                <SnapshotTitle snapshot={snapshot} current />
                <div className="mt-3">
                  <SnapshotBody snapshot={snapshot} cycle={cycle} />
                </div>
              </>
            ) : (
              <details>
                <summary className="min-h-6 cursor-pointer list-none">
                  <SnapshotTitle snapshot={snapshot} />
                </summary>
                <div className="mt-3">
                  <SnapshotBody snapshot={snapshot} cycle={cycle} />
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function SnapshotTitle({
  snapshot,
  current = false,
}: {
  snapshot: PayCycleSnapshotResponse
  current?: boolean
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium">Fechamento {snapshot.snapshot_version}</span>
      {current && <Badge variant="secondary">Em vigor</Badge>}
      <span className="text-sm text-muted-foreground">{describeClosedAt(snapshot.closed_at)}</span>
    </span>
  )
}

function SnapshotBody({
  snapshot,
  cycle,
}: {
  snapshot: PayCycleSnapshotResponse
  cycle: PayCycleResponse
}) {
  return (
    <CycleSummaryView
      summary={snapshotAsSummary(snapshot, cycle)}
      full
      caption={`Totais do fechamento ${snapshot.snapshot_version}`}
    />
  )
}
