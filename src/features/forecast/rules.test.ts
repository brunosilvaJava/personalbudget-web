import { describe, expect, it } from 'vitest'

import { formatMoney } from '@/lib/format'
import { cashForecast } from '@/test/fixtures'
import {
  describeInsufficientBudget,
  describeNegativeCash,
  horizonBounds,
  horizonError,
} from './rules'

describe('forecast rules', () => {
  const today = '2026-11-10'

  it('should accept a horizon from today to 366 days ahead', () => {
    expect(horizonBounds(today)).toEqual({ min: '2026-11-10', max: '2027-11-11' })
    expect(horizonError('2026-11-10', today)).toBeNull()
    expect(horizonError('2027-11-11', today)).toBeNull()
  })

  it('should refuse a horizon before today or past 366 days', () => {
    expect(horizonError('2026-11-09', today)).toBe('A data não pode ser anterior a hoje.')
    expect(horizonError('2027-11-12', today)).toBe('A data pode ir no máximo 366 dias à frente.')
  })

  it('should refuse what is not a date', () => {
    expect(horizonError('', today)).toBe('Informe uma data válida.')
    expect(horizonError('10/11/2026', today)).toBe('Informe uma data válida.')
  })

  it('should name the first negative day and the lowest cash', () => {
    const text = describeNegativeCash(
      cashForecast({
        first_negative_date: '2026-11-25',
        lowest_projected_cash: -320,
        lowest_projected_cash_date: '2026-11-28',
      }),
    )
    expect(text).toContain('25/11/2026')
    expect(text).toContain(`${formatMoney(-320)} em 28/11/2026`)
  })

  it('should still warn when the back sends no first negative day', () => {
    const text = describeNegativeCash(
      cashForecast({ first_negative_date: null, lowest_projected_cash: -10 }),
    )
    expect(text).toContain('algum dia até 03/12/2026')
  })

  it('should say how much the budget lacks', () => {
    const text = describeInsufficientBudget(
      cashForecast({ projected_cash: 1050, free_after_reserves: -150 }),
    )
    expect(text).toContain(formatMoney(1050))
    expect(text).toContain(`faltam ${formatMoney(150)}`)
  })
})
