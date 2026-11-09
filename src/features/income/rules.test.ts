import { describe, expect, it } from 'vitest'

import { occurrence } from '@/test/fixtures'
import { describeOccurrenceDate, describeRule, describeValidity } from './rules'

describe('describeRule', () => {
  it('should say the day of the month and what happens on a day that is not a business day', () => {
    const rule = {
      rule_type: 'FIXED_DAY',
      rule_value: 5,
      business_week: 'MONDAY_TO_FRIDAY',
    } as const
    expect(describeRule({ ...rule, non_business_day_policy: 'ANTICIPATE' })).toBe(
      'Dia 5 de cada mês, antecipada se não for dia útil',
    )
    expect(describeRule({ ...rule, non_business_day_policy: 'POSTPONE' })).toBe(
      'Dia 5 de cada mês, adiada se não for dia útil',
    )
    expect(describeRule({ ...rule, non_business_day_policy: 'KEEP' })).toBe(
      'Dia 5 de cada mês, mesmo em dia não útil',
    )
  })

  it('should say the position of the business day, with no policy', () => {
    expect(
      describeRule({
        rule_type: 'NTH_BUSINESS_DAY',
        rule_value: 5,
        business_week: 'MONDAY_TO_SATURDAY',
        non_business_day_policy: null,
      }),
    ).toBe('5º dia útil do mês')
  })
})

describe('describeValidity', () => {
  it('should say "sem fim" when there is no end and give the range when there is one', () => {
    expect(describeValidity({ start_month: '2026-11', end_month: null })).toBe(
      'desde nov/2026, sem fim',
    )
    expect(describeValidity({ start_month: '2026-11', end_month: '2027-03' })).toBe(
      'de nov/2026 a mar/2027',
    )
  })
})

describe('describeOccurrenceDate', () => {
  it('should show the date of a projected or materialized occurrence', () => {
    expect(describeOccurrenceDate(occurrence({ planned_date: '2026-12-04' }))).toBe('04/12/2026')
  })

  it('should explain why an occurrence has no date', () => {
    expect(
      describeOccurrenceDate(
        occurrence({ state: 'CALENDAR_NOT_REVIEWED', planned_date: null, pending_year: 2027 }),
      ),
    ).toBe('data não calculada: calendário de 2027 não revisado')
    expect(
      describeOccurrenceDate(occurrence({ state: 'BUSINESS_DAY_NOT_FOUND', planned_date: null })),
    ).toBe('o mês não tem esse dia útil')
  })
})
