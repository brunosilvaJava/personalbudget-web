import { Link } from 'react-router'

import type { PayCyclePendingResponse } from '@/api/contracts'
import { describePayCyclePending, pendingAction } from './rules'

/** The pendencies of the cycles in words, each with the place where it is fixed. */
export function PendingList({ pending }: { pending: readonly PayCyclePendingResponse[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-lg border border-warning/40 bg-warning/10">
      {pending.map((item, index) => {
        const action = pendingAction(item)
        return (
          <li key={index} className="flex flex-col gap-1 px-4 py-3 text-sm">
            <p>{describePayCyclePending(item)}</p>
            {action && (
              <Link
                to={action.to}
                className="min-h-6 w-fit font-medium text-primary underline-offset-4 hover:underline"
              >
                {action.label}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
