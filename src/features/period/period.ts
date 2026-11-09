import { differenceInCalendarDays } from 'date-fns'

import type { ISODate, PayCycleResponse, UUID, YearMonth } from '@/api/contracts'
import { currentMonth, monthOf, monthRange, parseApiDate, shiftDate } from '@/lib/dates'

/**
 * A period of the movements list and of the daily balance: both ends INCLUSIVE, as the API takes
 * them. A cycle period keeps the cycle code; its end is `last_day` (end_date_exclusive - 1).
 */
export interface Period {
  start: ISODate
  end: ISODate
  cycleCode?: UUID
}

export type PeriodKind = 'cycle' | 'month' | 'custom'

export function monthPeriod(month: YearMonth): Period {
  return monthRange(month)
}

export function cyclePeriod(cycle: PayCycleResponse): Period {
  return { start: cycle.start_date, end: cycle.last_day, cycleCode: cycle.code }
}

/** The default period: the current cycle when there is one, otherwise the current month. */
export function defaultPeriod(currentCycle: PayCycleResponse | null | undefined): Period {
  return currentCycle ? cyclePeriod(currentCycle) : monthPeriod(currentMonth())
}

export function periodKind(period: Period): PeriodKind {
  if (period.cycleCode) return 'cycle'
  const month = monthRange(monthOf(period.start))
  return month.start === period.start && month.end === period.end ? 'month' : 'custom'
}

/** Days in the period, both ends included. */
export function periodLength(period: Period): number {
  return differenceInCalendarDays(parseApiDate(period.end), parseApiDate(period.start)) + 1
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.start === b.start && a.end === b.end && (a.cycleCode ?? null) === (b.cycleCode ?? null)
}

/** A custom period moved by its own length: 10 days back, 10 days forward. */
export function shiftCustomPeriod(period: Period, direction: -1 | 1): Period {
  const days = periodLength(period) * direction
  return { start: shiftDate(period.start, days), end: shiftDate(period.end, days) }
}

// ───────────────────────── URL ─────────────────────────

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** ?inicio=2026-11-05&fim=2026-12-04&ciclo=<code>. Null when absent or invalid (end before start). */
export function readPeriod(params: URLSearchParams): Period | null {
  const start = params.get('inicio')
  const end = params.get('fim')
  if (!start || !end || !DATE.test(start) || !DATE.test(end) || end < start) return null
  const cycleCode = params.get('ciclo') ?? undefined
  return cycleCode ? { start, end, cycleCode } : { start, end }
}

export function writePeriod(params: URLSearchParams, period: Period): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set('inicio', period.start)
  next.set('fim', period.end)
  if (period.cycleCode) next.set('ciclo', period.cycleCode)
  else next.delete('ciclo')
  return next
}
