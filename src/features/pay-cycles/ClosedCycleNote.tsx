import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { PayCycleResponse } from '@/api/contracts'

/**
 * Says that the cycle a movement belongs to (by competence) is closed, what that blocks, and where
 * to reopen it. The back is the one that refuses; this only explains it before the tap.
 */
export function ClosedCycleNote({
  cycle,
  children,
}: {
  cycle: Pick<PayCycleResponse, 'code' | 'label'>
  children: ReactNode
}) {
  return (
    <div
      role="note"
      className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="flex flex-col gap-1">
        <p>
          <strong>O ciclo {cycle.label} está fechado.</strong> {children}
        </p>
        <Link
          to={`/ciclos/${cycle.code}`}
          className="min-h-6 w-fit font-medium text-primary underline-offset-4 hover:underline"
        >
          Abrir o ciclo
        </Link>
      </div>
    </div>
  )
}
