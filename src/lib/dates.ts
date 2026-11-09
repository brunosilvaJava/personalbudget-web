import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns'

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

/** The date `days` days away, e.g. the day before a cycle starts. */
export function shiftDate(date: ISODate, days: number): ISODate {
  return toApiDate(addDays(parseISO(date), days))
}

/** Calendar days from `from` to `to` (negative when `to` is earlier): 2026-11-10 → 2026-11-12 is 2. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from))
}

/** The month of a date: "2026-11-10" → "2026-11". */
export function monthOf(date: ISODate): YearMonth {
  return date.slice(0, 7)
}

/** The date part of a LocalDateTime: "2026-11-10T15:30:00" → "2026-11-10". */
export function dateOf(value: ISODate | ISODateTime): ISODate {
  return value.slice(0, 10)
}

// ───────────────────────── "Today" is always Brasília ─────────────────────────

/**
 * The app's clock. "Today" and "now" are the wall clock in Brasília, as on the back (PR #59),
 * even when the phone is in another time zone: a purchase at 22h in Lisbon is still "today" in
 * Brasília's calendar, where the API decides LATE and due dates.
 */
export const APP_TIME_ZONE = 'America/Sao_Paulo'

const wallClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function brasiliaParts(instant: Date): Record<string, string> {
  const parts: Record<string, string> = {}
  for (const { type, value } of wallClock.formatToParts(instant)) parts[type] = value
  return parts
}

/** Today in Brasília, e.g. "2026-11-10". */
export function todayIso(now: Date = new Date()): ISODate {
  const p = brasiliaParts(now)
  return `${p.year}-${p.month}-${p.day}`
}

/** Now in Brasília, without offset, e.g. "2026-11-10T15:30:00". */
export function nowApiDateTime(now: Date = new Date()): ISODateTime {
  const p = brasiliaParts(now)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
}

/** The current month in Brasília, e.g. "2026-11". */
export function currentMonth(now: Date = new Date()): YearMonth {
  return monthOf(todayIso(now))
}
