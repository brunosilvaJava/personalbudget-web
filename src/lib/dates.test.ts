import { describe, expect, it } from 'vitest'

import {
  monthRange,
  parseApiDate,
  shiftMonth,
  toApiDate,
  toApiDateTime,
  toYearMonth,
} from './dates'

describe('parseApiDate', () => {
  it('should keep the day of a LocalDate in Brasília time', () => {
    expect(parseApiDate('2026-11-10').getDate()).toBe(10)
  })

  it('should not shift like new Date does with a date-only string', () => {
    // The bug parseApiDate exists for: new Date reads "2026-11-10" as UTC midnight,
    // which is 21:00 of the 9th in Brasília. The tests run with TZ=America/Sao_Paulo.
    expect(new Date('2026-11-10').getDate()).toBe(9)
    expect(parseApiDate('2026-11-10').getDate()).toBe(10)
  })

  it('should read a LocalDateTime as local time', () => {
    const date = parseApiDate('2026-11-10T23:30:00')
    expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([10, 23, 30])
  })
})

describe('API formats', () => {
  const date = new Date(2026, 10, 10, 9, 5, 7)

  it('should write a LocalDate', () => {
    expect(toApiDate(date)).toBe('2026-11-10')
  })

  it('should write a LocalDateTime without offset', () => {
    expect(toApiDateTime(date)).toBe('2026-11-10T09:05:07')
  })

  it('should write a YearMonth', () => {
    expect(toYearMonth(date)).toBe('2026-11')
  })
})

describe('months', () => {
  it('should return the first and last day of a month, leap years included', () => {
    expect(monthRange('2028-02')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    })
    expect(monthRange('2026-11')).toEqual({
      start: '2026-11-01',
      end: '2026-11-30',
    })
  })

  it('should shift months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})
