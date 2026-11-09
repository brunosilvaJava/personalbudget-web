import { CreditCard, Repeat } from 'lucide-react'

import type { CategoryResponse, FinancialMovementResponse } from '@/api/contracts'
import { Amount } from '@/components/domain/Amount'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatShortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { cardInstallmentLabel, isCardInstallment } from './card'

interface MovementRowProps {
  movement: FinancialMovementResponse
  category: CategoryResponse | undefined
  /** opens the movement's actions; without it the row is not interactive */
  onSelect?: (movement: FinancialMovementResponse) => void
}

export function MovementRow({ movement, category, onSelect }: MovementRowProps) {
  const card = isCardInstallment(movement)
  const recurring = movement.recurrence_bill_code !== null && !card
  const unpaid = movement.status !== 'PAID_OUT'
  const paid = movement.amount_paid ?? 0
  const partial = unpaid && paid > 0

  const categoryName = movement.category_code ? (category?.name ?? 'Categoria') : 'Sem categoria'

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{movement.description}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {categoryName}
          {category?.status === 'INACTIVE' && ' (inativa)'}
          {unpaid && ` · vence ${formatShortDate(movement.due_date)}`}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={movement.status} operationType={movement.operation_type} />
          {card && (
            <Badge variant="secondary">
              <CreditCard aria-hidden />
              {cardInstallmentLabel(movement)}
            </Badge>
          )}
          {recurring && (
            <Badge variant="secondary">
              <Repeat aria-hidden />
              recorrente
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <Amount operationType={movement.operation_type} amount={movement.amount} />
        {partial && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {movement.operation_type === 'CREDIT' ? 'recebido' : 'pago'} {formatMoney(paid)}
          </span>
        )}
      </div>
    </>
  )

  const className = 'flex w-full items-start gap-3 px-4 py-3 text-left'
  if (!onSelect) return <div className={className}>{content}</div>
  return (
    <button
      type="button"
      className={cn(
        className,
        'min-h-11 transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none',
      )}
      onClick={() => onSelect(movement)}
    >
      {content}
    </button>
  )
}
