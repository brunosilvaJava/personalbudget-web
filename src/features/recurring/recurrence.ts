import { getDayOfYear, isLeapYear } from 'date-fns'

import type { FixedBillResponse, ISODate, RecurrenceType } from '@/api/contracts'
import { parseApiDate, toApiDate } from '@/lib/dates'
import { formatShortDate } from '@/lib/format'

/**
 * WEEKLY days follow the back's calculator (WeeklyCalcFixedBillImpl: java DayOfWeek + 1), so
 * 1 is Sunday, 2 Monday ... 7 Saturday.
 */
export const WEEKDAYS: { day: number; short: string; long: string }[] = [
  { day: 1, short: 'dom', long: 'domingo' },
  { day: 2, short: 'seg', long: 'segunda' },
  { day: 3, short: 'ter', long: 'terça' },
  { day: 4, short: 'qua', long: 'quarta' },
  { day: 5, short: 'qui', long: 'quinta' },
  { day: 6, short: 'sex', long: 'sexta' },
  { day: 7, short: 'sáb', long: 'sábado' },
]

export const RECURRENCE_LABEL: Record<RecurrenceType, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
}

/** YEARLY days are days of the year counted in reference_year (leap years shift after Feb 28). */
export function dayOfYear(date: ISODate): { day: number; referenceYear: number; leap: boolean } {
  const parsed = parseApiDate(date)
  return {
    day: getDayOfYear(parsed),
    referenceYear: parsed.getFullYear(),
    leap: isLeapYear(parsed),
  }
}

export function dateOfYearDay(day: number, referenceYear: number): ISODate {
  return toApiDate(new Date(referenceYear, 0, day))
}

function listDays(values: string[]): string {
  if (values.length <= 1) return values.join('')
  return `${values.slice(0, -1).join(', ')} e ${values.at(-1)}`
}

/** "Todo mês, dias 5 e 20", "Toda semana: segunda e quarta", "Todo ano, em 14/02". */
export function describeRecurrence(
  bill: Pick<FixedBillResponse, 'recurrence_type' | 'days' | 'reference_year'>,
): string {
  const days = [...bill.days].sort((a, b) => a - b)
  switch (bill.recurrence_type) {
    case 'WEEKLY':
      return `Toda semana: ${listDays(days.map((day) => WEEKDAYS.find((w) => w.day === day)?.long ?? String(day)))}`
    case 'MONTHLY':
      return `Todo mês, ${days.length === 1 ? 'dia' : 'dias'} ${listDays(days.map(String))}`
    case 'YEARLY': {
      const year = bill.reference_year ?? new Date().getFullYear()
      return `Todo ano, em ${listDays(days.map((day) => formatShortDate(dateOfYearDay(day, year))))}`
    }
  }
}

/** Whether `date` is an occurrence day of the rule (to tell that today's posting was generated). */
export function occursOn(
  bill: Pick<FixedBillResponse, 'recurrence_type' | 'days' | 'reference_year'>,
  date: ISODate,
): boolean {
  const parsed = parseApiDate(date)
  switch (bill.recurrence_type) {
    case 'WEEKLY':
      return bill.days.includes(parsed.getDay() + 1)
    case 'MONTHLY':
      return bill.days.includes(parsed.getDate())
    case 'YEARLY': {
      const year = bill.reference_year ?? parsed.getFullYear()
      return bill.days.some((day) => dateOfYearDay(day, year).slice(5) === date.slice(5))
    }
  }
}
