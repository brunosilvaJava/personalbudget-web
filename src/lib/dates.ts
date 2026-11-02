import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'

import type { ISODate, ISODateTime, YearMonth } from '@/api/contracts'

/**
 * Dates travel as text without time zone and are read as LOCAL time.
 *
 * Never `new Date('2026-11-10')`: the browser reads a date-only string as UTC midnight, which
 * in Brasília (UTC-3) is the previous day. parseISO reads it as local midnight.
 */
export function parseApiDate(value: ISODate | ISODateTime): Date {
  return parseISO(value)
}

/** LocalDate for the API, e.g. "2026-11-10". */
export function toApiDate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

/** LocalDateTime for the API, without offset, e.g. "2026-11-10T15:30:00". */
export function toApiDateTime(date: Date): ISODateTime {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss")
}

/** YearMonth for /dashboard?month=, e.g. "2026-11". */
export function toYearMonth(date: Date): YearMonth {
  return format(date, 'yyyy-MM')
}

/** First and last day of a month, e.g. the default period of the movements list. */
export function monthRange(month: YearMonth): { start: ISODate; end: ISODate } {
  const first = parseISO(`${month}-01`)
  return {
    start: toApiDate(startOfMonth(first)),
    end: toApiDate(endOfMonth(first)),
  }
}

/** The month `offset` months away from `month`, e.g. for the month picker arrows. */
export function shiftMonth(month: YearMonth, offset: number): YearMonth {
  return toYearMonth(addMonths(parseISO(`${month}-01`), offset))
}
