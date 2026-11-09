import { describe, expect, it } from 'vitest'

import { describeRecurrence, occursOn } from './recurrence'

type Rule = Parameters<typeof occursOn>[0]

describe('describeRecurrence', () => {
  it('should list the days of the month in order, with "e" before the last', () => {
    expect(
      describeRecurrence({ recurrence_type: 'MONTHLY', days: [20, 5], reference_year: null }),
    ).toBe('Todo mês, dias 5 e 20')
    expect(
      describeRecurrence({ recurrence_type: 'MONTHLY', days: [1, 15, 30], reference_year: null }),
    ).toBe('Todo mês, dias 1, 15 e 30')
  })

  it('should use the singular for one day of the month', () => {
    expect(
      describeRecurrence({ recurrence_type: 'MONTHLY', days: [5], reference_year: null }),
    ).toBe('Todo mês, dia 5')
  })

  it('should name the weekdays with 1 as Sunday, as the back counts them', () => {
    expect(
      describeRecurrence({ recurrence_type: 'WEEKLY', days: [4, 2], reference_year: null }),
    ).toBe('Toda semana: segunda e quarta')
  })

  it('should turn a day of the year into its date in the reference year', () => {
    expect(
      describeRecurrence({ recurrence_type: 'YEARLY', days: [45], reference_year: 2026 }),
    ).toBe('Todo ano, em 14/02')
  })
})

describe('occursOn', () => {
  it('should match the day of the month', () => {
    const bill: Rule = { recurrence_type: 'MONTHLY', days: [10], reference_year: null }
    expect(occursOn(bill, '2026-11-10')).toBe(true)
    expect(occursOn(bill, '2026-11-11')).toBe(false)
  })

  it('should match the weekday, with 1 as Sunday: Tuesday is 3', () => {
    const bill: Rule = { recurrence_type: 'WEEKLY', days: [3], reference_year: null }
    expect(occursOn(bill, '2026-11-10')).toBe(true) // a Tuesday
    expect(occursOn(bill, '2026-11-09')).toBe(false) // a Monday
  })

  it('should match the date of a day of the year', () => {
    const bill: Rule = { recurrence_type: 'YEARLY', days: [314], reference_year: 2026 }
    expect(occursOn(bill, '2026-11-10')).toBe(true)
    expect(occursOn(bill, '2026-11-11')).toBe(false)
  })
})
