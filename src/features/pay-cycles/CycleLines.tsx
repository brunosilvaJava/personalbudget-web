import type { PayCycleResponse } from '@/api/contracts'
import { CycleFlags, CycleStatusBadge } from './CycleBadges'
import { describeCycleDates } from './rules'

/** Cycles as lines (label, dates, flags), for the previews. Empty renders nothing. */
export function CycleLines({
  cycles,
  showStatus = false,
}: {
  cycles: readonly PayCycleResponse[]
  /** a preview has no stored status worth showing; a started cycle does */
  showStatus?: boolean
}) {
  if (cycles.length === 0) return null
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {cycles.map((cycle, index) => (
        <li key={`${cycle.code}-${index}`} className="flex flex-col gap-1 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{cycle.label}</span>
            {showStatus && <CycleStatusBadge status={cycle.status} />}
            <CycleFlags cycle={cycle} />
          </div>
          <span className="text-muted-foreground">{describeCycleDates(cycle)}</span>
        </li>
      ))}
    </ul>
  )
}
