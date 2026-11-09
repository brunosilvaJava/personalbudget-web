import { Lock } from 'lucide-react'
import { Link } from 'react-router'

import type { IncomeScheduleResponse } from '@/api/contracts'
import { usePayCycleConfig } from './queries'

/**
 * On the anchor schedule while the cycles are on: its rule, end month and status are protected
 * (the back answers 409) and only change through the anchor transition. Renders nothing for any
 * other schedule, or while the cycles are off.
 */
export function AnchorLockedNote({ schedule }: { schedule: IncomeScheduleResponse }) {
  if (!schedule.anchor) return null
  return <LockedNote />
}

function LockedNote() {
  const config = usePayCycleConfig()
  if (config.data?.mode !== 'PAY_CYCLE') return null

  return (
    <div role="note" className="flex gap-3 rounded-lg border bg-card p-4 text-sm">
      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p>
        Esta receita abre os ciclos financeiros. Com os ciclos ligados, a regra, o fim da vigência e
        a situação dela só mudam pela transição de âncora, que refaz os ciclos futuros e guarda o
        motivo. Descrição, valor e categoria mudam normalmente.{' '}
        <Link
          to="/ciclos?ancora=1"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Mudar a receita âncora
        </Link>
      </p>
    </div>
  )
}
