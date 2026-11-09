import type { PayCycleResponse, PayCycleStatus } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { CYCLE_KIND_LABEL, CYCLE_STATUS_LABEL, CYCLE_STATUS_VARIANT } from './rules'

export function CycleStatusBadge({ status }: { status: PayCycleStatus }) {
  return <Badge variant={CYCLE_STATUS_VARIANT[status]}>{CYCLE_STATUS_LABEL[status]}</Badge>
}

/** What is special about a cycle: a transition, a boundary fixed by hand, a pendency. */
export function CycleFlags({ cycle }: { cycle: PayCycleResponse }) {
  return (
    <>
      {cycle.kind === 'TRANSITION' && (
        <Badge variant="outline">{CYCLE_KIND_LABEL.TRANSITION}</Badge>
      )}
      {(cycle.start_adjusted || cycle.end_adjusted) && (
        <Badge variant="outline">virada ajustada</Badge>
      )}
      {cycle.pending.length > 0 && <Badge variant="warning">pendência</Badge>}
    </>
  )
}
