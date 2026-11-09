import type { CreditCardLimitResponse } from '@/api/contracts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Used x available of a card. Without a limit, only what is used. */
export function LimitBar({ limit }: { limit: CreditCardLimitResponse | undefined }) {
  if (!limit) return <div className="h-2 rounded-full bg-muted" aria-hidden />
  if (limit.credit_limit === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem limite cadastrado · usado {formatMoney(limit.used)}
      </p>
    )
  }
  const share = limit.credit_limit > 0 ? Math.min(1, limit.used / limit.credit_limit) : 1
  const percent = Math.round(share * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="meter"
        aria-label="Limite usado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% do limite usado`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full', share >= 0.9 ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="flex justify-between gap-2 text-sm text-muted-foreground tabular-nums">
        <span>Usado {formatMoney(limit.used)}</span>
        <span>Disponível {formatMoney(limit.available ?? 0)}</span>
      </p>
    </div>
  )
}
