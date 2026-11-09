import { signedAmount, type Money, type OperationType } from '@/api/contracts'
import { formatSignedMoney, formatSignedValue } from '@/lib/format'
import { cn } from '@/lib/utils'

type AmountProps = { className?: string } & (
  | { operationType: OperationType; amount: Money; value?: never }
  | { value: Money; operationType?: never; amount?: never }
)

/**
 * Money with sign and color: revenue green, expense red. Either from operation_type (the sign the
 * API sent is ignored) or from a value that already carries its sign (balances, totals).
 */
export function Amount({ className, ...props }: AmountProps) {
  const value =
    props.operationType !== undefined
      ? signedAmount(props.operationType, props.amount)
      : props.value
  const text =
    props.operationType !== undefined
      ? formatSignedMoney(props.operationType, props.amount)
      : formatSignedValue(props.value)
  return (
    <span
      className={cn(
        'font-medium whitespace-nowrap tabular-nums',
        value > 0 && 'text-income',
        value < 0 && 'text-expense',
        className,
      )}
    >
      {text}
    </span>
  )
}
