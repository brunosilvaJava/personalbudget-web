import { signedAmount, type FinancialMovementResponse, type ISODate } from '@/api/contracts'
import { dateOf } from '@/lib/dates'
import { fromCents, toCents } from '@/lib/money'

export interface MovementDay {
  date: ISODate
  movements: FinancialMovementResponse[]
  /** revenue minus expense of the day, in reais (summed in cents) */
  net: number
}

/** Groups by the day of movement_date, keeping the order the API sent (newest first). */
export function groupByDay(movements: readonly FinancialMovementResponse[]): MovementDay[] {
  const days: MovementDay[] = []
  const byDate = new Map<ISODate, { day: MovementDay; cents: number }>()
  for (const movement of movements) {
    const date = dateOf(movement.movement_date)
    let entry = byDate.get(date)
    if (!entry) {
      entry = { day: { date, movements: [], net: 0 }, cents: 0 }
      byDate.set(date, entry)
      days.push(entry.day)
    }
    entry.day.movements.push(movement)
    entry.cents += toCents(signedAmount(movement.operation_type, movement.amount))
    entry.day.net = fromCents(entry.cents)
  }
  return days
}
